import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../storage/db';
import {
  decodeSetupToken,
  claimSetupToken,
  createClient,
  connect,
  getConnection,
  clearConnection,
  hasScope,
  MynaError,
  SCOPES_USED,
} from '../myna';

const toBase64url = (text) => btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const CLAIM_URL = 'https://mynaposter.com/api/openconnection/claim/abc123';
const TOKEN = toBase64url(CLAIM_URL);

const reply = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => headers[name.toLowerCase()] ?? null },
  json: async () => body,
});

describe('decodeSetupToken', () => {
  it('decodes base64url to the https claim URL, whitespace tolerated', () => {
    expect(decodeSetupToken(` ${TOKEN}\n`)).toBe(CLAIM_URL);
  });

  it('refuses an empty paste, garbage, a non-URL and a non-https URL', () => {
    expect(() => decodeSetupToken('')).toThrow(/Paste the setup token/);
    expect(() => decodeSetupToken('not base64 at all!!')).toThrow(MynaError);
    expect(() => decodeSetupToken(toBase64url('just words'))).toThrow(/not a setup token/);
    expect(() => decodeSetupToken(toBase64url('http://bridge.example/claim/x'))).toThrow(/https/);
  });
});

describe('claimSetupToken', () => {
  it('POSTs the app identity to the claim URL and returns the connection', async () => {
    const fetchImpl = vi.fn(async () =>
      reply(200, {
        access_url: 'https://mynaposter.com/api/openconnection/v1/',
        token: 'oc_secret',
        auth: 'bearer',
        scopes: ['write:create'],
        profiles: ['social'],
        expires: null,
        principal: { name: 'Anthony' },
      }),
    );
    const connection = await claimSetupToken(TOKEN, { app: { name: 'DefPromo', url: 'https://defpromo.com' }, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(CLAIM_URL);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ app: { name: 'DefPromo', url: 'https://defpromo.com' } });
    expect(connection).toMatchObject({
      accessUrl: 'https://mynaposter.com/api/openconnection/v1',
      token: 'oc_secret',
      scopes: ['write:create'],
      principal: { name: 'Anthony' },
      bridge: 'https://mynaposter.com',
    });
  });

  it('explains a claimed, expired or unknown token in the person’s terms', async () => {
    for (const [status, code, wording] of [
      [403, 'claimed', /already claimed/],
      [410, 'expired', /expired/],
      [404, 'unknown', /does not know/],
    ]) {
      const fetchImpl = vi.fn(async () => reply(status, { error: code, message: 'x' }));
      await expect(claimSetupToken(TOKEN, { fetchImpl })).rejects.toThrow(wording);
      await expect(claimSetupToken(TOKEN, { fetchImpl })).rejects.toMatchObject({ code, status });
    }
  });
});

describe('createClient', () => {
  const connection = { accessUrl: 'https://mynaposter.com/api/openconnection/v1', token: 'oc_secret', scopes: ['write:create'] };

  it('sends the bearer and JSON to the access URL', async () => {
    const fetchImpl = vi.fn(async () => reply(200, { variations: ['a'] }));
    const result = await createClient(connection, fetchImpl).write({ kind: 'post' });
    expect(result).toEqual({ variations: ['a'] });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://mynaposter.com/api/openconnection/v1/write');
    expect(init.headers.Authorization).toBe('Bearer oc_secret');
    expect(JSON.parse(init.body)).toEqual({ kind: 'post' });
  });

  it('maps revoked, scope, writer and rate-limit refusals to messages a person can act on', async () => {
    const client = (status, body, headers) => createClient(connection, vi.fn(async () => reply(status, body, headers)));
    await expect(client(401, { error: 'revoked' }).info()).rejects.toThrow(/revoked.*mynaposter.com\/connect/);
    await expect(client(403, { error: 'scope', scope: 'suggest:create' }).suggest({})).rejects.toThrow(/lacks suggest:create/);
    await expect(client(503, { error: 'writer', message: 'ANTHROPIC_API_KEY is not set.' }).analyze('x')).rejects.toThrow(/writer is off/);
    const limited = client(429, { error: 'rate_limited' }, { 'retry-after': '42' });
    await expect(limited.write({})).rejects.toMatchObject({ code: 'rate_limited', retryAfter: 42 });
  });

  it('refuses to be made without a connection', () => {
    expect(() => createClient(null)).toThrow(/Not connected/);
  });
});

describe('the stored connection', () => {
  beforeEach(async () => {
    await db.settings.clear();
  });

  it('connect claims and stores next to the other settings; clear forgets it and tells the bridge', async () => {
    await db.settings.put({ id: 'main', openaiKey: 'sk-keep-me' });
    const fetchImpl = vi.fn(async (url) =>
      url === CLAIM_URL ? reply(200, { access_url: 'https://mynaposter.com/api/openconnection/v1', token: 'oc_t', scopes: ['activity:write'] }) : reply(200, { ok: true }),
    );
    const connection = await connect(TOKEN, { fetchImpl });
    expect(connection.token).toBe('oc_t');
    expect((await getConnection()).token).toBe('oc_t');
    expect((await db.settings.get('main')).openaiKey).toBe('sk-keep-me');
    expect(hasScope(await getConnection(), 'activity:write')).toBe(true);
    expect(hasScope(await getConnection(), 'write:create')).toBe(false);

    await clearConnection({ fetchImpl });
    expect(await getConnection()).toBeNull();
    expect((await db.settings.get('main')).openaiKey).toBe('sk-keep-me');
    const deleteCall = fetchImpl.mock.calls.find(([, init]) => init?.method === 'DELETE');
    expect(deleteCall[0]).toBe('https://mynaposter.com/api/openconnection/v1/');
  });

  it('names the scopes it uses', () => {
    expect(Object.keys(SCOPES_USED)).toEqual(['analyze:create', 'write:create', 'suggest:create', 'accounts:read', 'activity:write']);
  });
});
