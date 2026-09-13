import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workflow = fs.readFileSync(new URL('../.github/workflows/coinpay.yml', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../.github/coinpay.yml', import.meta.url), 'utf8');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

// Execute the actual inline GitHub scripts against mocks; no network or keys.
function scriptFor(stepName) {
  const step = workflow.split(`      - name: ${stepName}\n`)[1]?.split('\n      - name: ')[0];
  const block = step?.split('          script: |\n')[1];
  assert.ok(block, `missing script: ${stepName}`);
  const source = block.split('\n').filter(line => line.startsWith('            ')).map(line => line.slice(12)).join('\n');
  return new AsyncFunction('github', 'context', 'core', 'process', source);
}

const authorize = scriptFor('Verify repository permission');
const setup = scriptFor('Check CoinPay setup');

function fixture(permission = 'write') {
  const outputs = {}, messages = [], requests = [];
  const core = {
    setOutput: (key, value) => { outputs[key] = value; },
    notice: value => messages.push(value),
    warning: value => messages.push(value),
    summary: { addRaw: value => { messages.push(value); return { write: async () => {} }; } },
  };
  const context = {
    eventName: 'issue_comment', repo: { owner: 'ralyodio', repo: 'defpromo' },
    payload: { action: 'created', issue: { number: 42, pull_request: {} },
      comment: { body: '/coinpay create 25 USD --wallet verified-recipient --dry-run',
        user: { login: 'contributor', type: 'User' }, author_association: 'MEMBER' } },
  };
  const github = { rest: { repos: { getCollaboratorPermissionLevel: async args => {
    requests.push(args);
    if (permission instanceof Error) throw permission;
    return { data: { permission } };
  } } } };
  return { outputs, messages, requests, core, context, github };
}

for (const permission of ['write', 'maintain', 'admin']) {
  test(`authorizes current ${permission} access from GitHub`, async () => {
    const f = fixture(permission);
    await authorize(f.github, f.context, f.core, { env: {} });
    assert.equal(f.outputs.allowed, true);
    assert.deepEqual(f.requests, [{ owner: 'ralyodio', repo: 'defpromo', username: 'contributor' }]);
  });
}

for (const permission of ['read', 'triage', 'none', null, 'unexpected']) {
  test(`rejects ${String(permission)} access despite MEMBER association`, async () => {
    const f = fixture(permission);
    await authorize(f.github, f.context, f.core, { env: {} });
    assert.equal(f.outputs.allowed, false);
  });
}

test('permission lookup failure stays denied and hides upstream errors', async () => {
  const f = fixture(new Error('private upstream details'));
  await authorize(f.github, f.context, f.core, { env: {} });
  assert.equal(f.outputs.allowed, false);
  assert.ok(!f.messages.join('').includes('private upstream details'));
});

for (const [name, change] of [
  ['edited comment', f => { f.context.payload.action = 'edited'; }],
  ['bot actor', f => { f.context.payload.comment.user.type = 'Bot'; }],
  ['issue instead of PR', f => { delete f.context.payload.issue.pull_request; }],
  ['other event', f => { f.context.eventName = 'pull_request'; }],
  ['unrelated comment', f => { f.context.payload.comment.body = 'mention /coinpay in prose'; }],
]) {
  test(`ignores ${name} without a GitHub lookup`, async () => {
    const f = fixture(); change(f);
    await authorize(f.github, f.context, f.core, { env: {} });
    assert.equal(f.outputs.allowed, false);
    assert.deepEqual(f.requests, []);
  });
}

for (const env of [{}, { COINPAY_API_KEY: 'fake' }, { COINPAY_API_KEY: ' ', COINPAY_BUSINESS_ID: 'fake' }]) {
  test(`missing setup ${Object.keys(env).join(',') || 'both'} prevents the action`, async () => {
    const f = fixture();
    await setup(f.github, f.context, f.core, { env });
    assert.equal(f.outputs.configured, false);
    assert.deepEqual(f.requests, []);
  });
}

test('configured setup reveals no values and performs no network request', async () => {
  const f = fixture();
  await setup(f.github, f.context, f.core, { env: { COINPAY_API_KEY: 'fixture-private-key', COINPAY_BUSINESS_ID: 'fixture-business' } });
  assert.equal(f.outputs.configured, true);
  assert.deepEqual(f.messages, []);
  assert.deepEqual(f.requests, []);
});

test('financial workflow uses immutable actions, both gates, and no PR checkout', () => {
  const references = [...workflow.matchAll(/uses: (\S+)/g)].map(match => match[1]);
  assert.ok(references.every(ref => /@[a-f0-9]{40}$/.test(ref)));
  assert.ok(references.includes('profullstack/coinpaybot@fbf099175de2d8f6ed105b20d677e7a30b19cfac'));
  assert.match(workflow, /if: steps\.authorization\.outputs\.allowed == 'true' && steps\.setup\.outputs\.configured == 'true'/);
  assert.ok(!workflow.includes('actions/checkout@'));
  assert.ok(!workflow.includes('pull_request_target:'));
  assert.match(config, /githubInvoices:\s*\n\s+enabled: false/);
});
