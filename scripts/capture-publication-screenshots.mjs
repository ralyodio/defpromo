// Capture the actual packaged UI with a disposable IndexedDB example.
// No prompts, accounts, API credentials or real engagement data are used.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const [artifactArg, outputArg] = process.argv.slice(2);
if (!artifactArg || !outputArg)
  throw new Error(
    'Usage: node scripts/capture-publication-screenshots.mjs ARTIFACT_DIR OUTPUT_DIR'
  );
const artifact = resolve(artifactArg),
  output = resolve(outputArg);
const manifest = JSON.parse(await readFile(join(artifact, 'manifest.json'), 'utf8'));
await mkdir(output, { recursive: true });
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  try {
    const path = resolve(artifact, '.' + new URL(req.url, 'http://local').pathname);
    if (!path.startsWith(artifact + '/')) throw new Error('Invalid path');
    const bytes = await readFile(path);
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ['--no-sandbox'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  const blocked = [];
  await context.route('**/*', (route) => {
    if (
      route
        .request()
        .url()
        .startsWith(base + '/')
    )
      return route.continue();
    blocked.push(new URL(route.request().url()).origin);
    return route.abort();
  });
  await context.addInitScript(
    ({ version }) => {
      window.chrome = {
        runtime: {
          getManifest: () => ({ version }),
          onMessage: { addListener() {}, removeListener() {} },
        },
        tabs: {
          query: async () => [
            {
              id: 1,
              url: 'https://example.test/field-notes',
              title: 'Field Notes — example project',
            },
          ],
        },
      };
    },
    { version: manifest.version }
  );
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/src/sidepanel/index.html', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '+ New Project', exact: true }).waitFor();
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('DefPromoDB');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const at = Date.parse('2026-09-13T09:00:00Z');
    const project = {
      id: 'example-project',
      name: 'Field Notes — example project',
      url: 'https://example.test/field-notes',
      description:
        'An example field journal for gardeners: keep planting notes, save observations and export your notebook.',
      targetAudience: 'Home gardeners',
      keyFeatures: ['Planting notes', 'Seasonal observations', 'Notebook export'],
      tone: 'helpful',
      createdAt: at,
      updatedAt: at,
    };
    const tx = db.transaction(['settings', 'projects', 'generatedContent'], 'readwrite');
    tx.objectStore('settings').put({ id: 'main', activeProjectId: project.id });
    tx.objectStore('projects').put(project);
    tx.objectStore('generatedContent').put({
      id: 'example-drafts',
      projectId: project.id,
      type: 'comment',
      createdAt: at,
      variations: [
        {
          id: 'example-draft-1',
          text: 'Sample draft: I keep a short note after each planting—what went in, where it went and what changed. It makes next season easier to plan.',
          createdAt: at,
        },
        {
          id: 'example-draft-2',
          text: 'Sample draft: A photo and a few lines about the weather can be more useful than a perfect spreadsheet. Field Notes is an example project for keeping those observations together.',
          createdAt: at,
        },
      ],
    });
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Field Notes — example project', exact: true }).waitFor();
  await page.screenshot({ path: join(output, '01-project.png') });
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'View Variations →', exact: true }).click();
  await page.locator('main').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: join(output, '02-drafts.png') });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.locator('main').evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: join(output, '03-settings.png') });
  assert.deepEqual(errors, []);
  assert.deepEqual(blocked, []);
  await writeFile(
    join(output, 'capture.json'),
    JSON.stringify(
      {
        version: manifest.version,
        viewport: { width: 1280, height: 800 },
        actualPackagedUI: true,
        isolatedLocalFixture: true,
        fixtureProject: 'Field Notes — example project',
        drafts: 'Manually authored sample drafts, marked in the UI',
        fabricatedPerformanceMetrics: false,
        providerRequests: 0,
        publishedPosts: 0,
        screenshots: ['01-project.png', '02-drafts.png', '03-settings.png'],
      },
      null,
      2
    ) + '\n'
  );
  console.log({ version: manifest.version, screenshots: 3, externalRequests: 0 });
} finally {
  await browser.close();
  server.close();
}
