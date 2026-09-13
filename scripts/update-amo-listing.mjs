// Explicit publisher action. Defaults to a read-only preview.
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHmac, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
const apply = process.argv.includes('--apply');
const envPath = process.env.DEFPROMO_PUBLISHER_ENV;
const root = resolve('docs/publications');
const metadata = JSON.parse(await readFile(join(root, 'firefox-metadata.json'), 'utf8'));
// AMO wraps plain URLs with its outgoing-link redirect in public API responses.
const descriptionText = (text) => text.replace(/<a\b[^>]*>([^<]*)<\/a>/g, '$1');
const capture = JSON.parse(await readFile(join(root, 'screenshots/firefox/capture.json'), 'utf8'));
const endpoint = 'https://addons.mozilla.org/api/v5/addons/addon/defpromo/';
const before = await (
  await fetch(endpoint + '?publication_read=' + Date.now(), { signal: AbortSignal.timeout(30000) })
).json();
assert.equal(before.guid, 'defpromo@profullstack.com');
assert.equal(
  before.current_version.version,
  capture.version,
  'Listing package changed: audit copy and capture the new package before publishing.'
);
assert.ok(metadata.summary['en-US'].length <= 250);
const shots = [
  [
    '02-drafts.png',
    'Review, edit or copy saved variations. Firefox ' +
      capture.version +
      '; example project and sample drafts.',
  ],
  [
    '01-project.png',
    'Keep a product brief and reusable project context locally. Firefox ' +
      capture.version +
      '; example project.',
  ],
];
for (const [file] of shots) {
  const bytes = await readFile(join(root, 'screenshots/firefox', file));
  assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
  assert.equal(bytes.readUInt32BE(16), 1280);
  assert.equal(bytes.readUInt32BE(20), 800);
}
if (!apply) {
  console.log(
    JSON.stringify(
      {
        mode: 'preview',
        addon: before.guid,
        version: capture.version,
        metadata,
        screenshots: shots,
      },
      null,
      2
    )
  );
  process.exit(0);
}
if (!envPath) throw new Error('Set DEFPROMO_PUBLISHER_ENV to a private environment file.');
const env = parseEnv(await readFile(envPath, 'utf8'));
if (!env.FIREFOX_JWT_ISSUER || !env.FIREFOX_JWT_SECRET)
  throw new Error('AMO publisher credentials are missing.');
function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const body = [
    { alg: 'HS256', typ: 'JWT' },
    { iss: env.FIREFOX_JWT_ISSUER, jti: randomUUID(), iat: now, exp: now + 60 },
  ]
    .map((v) => Buffer.from(JSON.stringify(v)).toString('base64url'))
    .join('.');
  return body + '.' + createHmac('sha256', env.FIREFOX_JWT_SECRET).update(body).digest('base64url');
}
async function mutate(path, method, body, attempt = 0) {
  const form = body instanceof FormData;
  const r = await fetch(endpoint + path, {
    method,
    signal: AbortSignal.timeout(30000),
    headers: {
      authorization: 'JWT ' + jwt(),
      ...(body && !form ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: form ? body : JSON.stringify(body) } : {}),
  });
  if (r.status === 429 && attempt < 3) {
    const seconds = Number(r.headers.get('retry-after') || 60);
    if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 60) {
      console.log(`AMO rate limit: waiting ${Math.max(1, seconds)} seconds before retrying.`);
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, seconds) * 1000));
      return mutate(path, method, body, attempt + 1);
    }
  }
  if (!r.ok)
    throw new Error(
      `AMO ${method} ${path || 'metadata'} failed (${r.status}); Retry-After: ${r.headers.get('retry-after') || 'unspecified'} seconds. No credentials are logged.`
    );
  return r.status === 204 ? null : r.json();
}
const statePath = join(root, 'firefox-publication.json');
let state;
try {
  state = JSON.parse(await readFile(statePath, 'utf8'));
} catch {
  state = { version: capture.version, screenshots: [] };
}
assert.equal(state.version, capture.version);
const save = () => writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
if (
  before.summary?.['en-US'] !== metadata.summary['en-US'] ||
  descriptionText(before.description?.['en-US'] || '') !== metadata.description['en-US'] ||
  before.requires_payment !== metadata.requires_payment
)
  await mutate('', 'PATCH', metadata);
state.metadataUpdated = true;
await save();
for (let i = 0; i < shots.length; i++) {
  const [file, caption] = shots[i];
  let saved = state.screenshots.find((s) => s.file === file);
  if (!saved || !before.previews.some((p) => p.id === saved.id)) {
    const data = new FormData();
    data.set(
      'image',
      new Blob([await readFile(join(root, 'screenshots/firefox', file))], { type: 'image/png' }),
      file
    );
    data.set('position', String(i));
    const preview = await mutate('previews/', 'POST', data);
    saved = { file, id: preview.id };
    state.screenshots = state.screenshots.filter((s) => s.file !== file);
    state.screenshots.push(saved);
    await save();
  }
  const current = before.previews.find((preview) => preview.id === saved.id);
  if (current?.caption?.['en-US'] !== caption || current?.position !== i)
    await mutate(`previews/${saved.id}/`, 'PATCH', { caption: { 'en-US': caption }, position: i });
}
// Preserve the old preview until every replacement has uploaded and been captioned.
for (const old of before.previews)
  if (!state.screenshots.some((s) => s.id === old.id))
    await mutate(`previews/${old.id}/`, 'DELETE');
const after = await (
  await fetch(endpoint + '?verification=' + Date.now(), { signal: AbortSignal.timeout(30000) })
).json();
assert.equal(after.summary['en-US'], metadata.summary['en-US']);
assert.equal(descriptionText(after.description['en-US']), metadata.description['en-US']);
assert.equal(after.requires_payment, true);
for (const s of state.screenshots) assert.ok(after.previews.some((p) => p.id === s.id));
assert.ok(after.previews.every((p) => state.screenshots.some((s) => s.id === p.id)));
state.retainedPreviousPreviewIds = [];
delete state.pending;
state.verifiedAt = new Date().toISOString();
state.publicUrl = after.url;
await save();
console.log({
  updated: true,
  verifiedPublicly: true,
  version: capture.version,
  screenshots: state.screenshots.length,
  url: after.url,
});
