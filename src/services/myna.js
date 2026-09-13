/**
 * myna, over OpenConnection (https://logicsrc.com/openconnection).
 *
 * The default provider. A person gets a setup token at mynaposter.com/connect,
 * pastes it here, and DefPromo claims it once for a bearer of its own. From
 * then on every model call (analyze a page, write posts, suggest places) goes
 * through the person's myna, scoped to what they ticked, and revocable from
 * their list. No OpenAI key, no scraper key, nothing for DefPromo to keep but
 * the bearer, which is stored like a password and shown to nobody.
 */

import { db } from '../storage/db.js';
import { logError, logDebug } from './logger.js';

export const MYNA_SITE = 'https://mynaposter.com';
export const MYNA_CONNECT_URL = `${MYNA_SITE}/connect`;
export const MYNA_DESCRIPTOR_URL = `${MYNA_SITE}/.well-known/openconnection.json`;
export const OPENCONNECTION_SPEC_URL = 'https://logicsrc.com/openconnection';

/** The scopes DefPromo uses, and which feature each one unlocks. */
export const SCOPES_USED = {
  'analyze:create': 'Create a project from a URL',
  'write:create': 'Generate posts and comments',
  'suggest:create': 'Suggest subreddits, hashtags, keywords and forums',
  'accounts:read': 'Show the networks you connected',
  'activity:write': 'Tell myna what you posted, for its history and recap',
};

/** A refused request, with the code the spec names. */
export class MynaError extends Error {
  constructor(message, { status = 0, code = 'error', retryAfter = 0, scope = '' } = {}) {
    super(message);
    this.name = 'MynaError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.scope = scope;
  }
}

const base64urlDecode = (text) => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const bytes = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(bytes, (c) => c.charCodeAt(0)));
};

/**
 * The claim URL inside a setup token. The token is base64url of an https
 * URL; anything else is a paste of the wrong thing.
 * @param {string} token
 * @returns {string} the claim URL
 */
export const decodeSetupToken = (token) => {
  const trimmed = String(token || '').trim();
  if (!trimmed) throw new MynaError('Paste the setup token from mynaposter.com/connect.', { code: 'token' });
  let text;
  try {
    text = base64urlDecode(trimmed);
  } catch {
    throw new MynaError('That is not a setup token: it does not decode.', { code: 'token' });
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new MynaError('That is not a setup token: it does not decode to a URL.', { code: 'token' });
  }
  if (url.protocol !== 'https:') throw new MynaError("A setup token's claim URL must be https.", { code: 'token' });
  return url.toString();
};

/** What DefPromo says about itself at claim, so the person recognises it on their list. */
export const appIdentity = () => {
  let version = '';
  try {
    const api = typeof browser !== 'undefined' ? browser : typeof chrome !== 'undefined' ? chrome : null;
    version = api?.runtime?.getManifest?.()?.version || '';
  } catch {
    version = '';
  }
  return { name: 'DefPromo', url: 'https://defpromo.com', ...(version ? { version } : {}) };
};

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const refusal = (response, data) => {
  const message = data?.message || data?.error || `HTTP ${response.status}`;
  return new MynaError(message, {
    status: response.status,
    code: data?.error || 'error',
    retryAfter: Number(response.headers?.get?.('retry-after')) || 0,
    scope: data?.scope || '',
  });
};

/**
 * Trade a setup token for a connection. Once: a second claim of the same
 * token is refused by the bridge, and it tells the person.
 * @param {string} token - the pasted setup token
 * @param {Object} [options]
 * @param {Object} [options.app] - what to say about this app
 * @param {Function} [options.fetchImpl]
 * @returns {Promise<Object>} the connection to store
 */
export const claimSetupToken = async (token, { app = appIdentity(), fetchImpl = fetch } = {}) => {
  const claimUrl = decodeSetupToken(token);
  const response = await fetchImpl(claimUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ app }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = refusal(response, data);
    if (error.code === 'claimed') error.message = 'That setup token was already claimed. Make a new one at mynaposter.com/connect.';
    if (error.code === 'expired') error.message = 'That setup token expired. Make a new one at mynaposter.com/connect.';
    if (error.code === 'unknown') error.message = 'myna does not know that setup token. Copy it again from mynaposter.com/connect.';
    throw error;
  }
  if (!data.access_url || !data.token) throw new MynaError('The bridge answered without an access URL and a token.', { code: 'claim' });
  return {
    accessUrl: String(data.access_url).replace(/\/+$/, ''),
    token: data.token,
    scopes: Array.isArray(data.scopes) ? data.scopes : [],
    profiles: Array.isArray(data.profiles) ? data.profiles : [],
    expires: data.expires || null,
    principal: data.principal || {},
    bridge: new URL(claimUrl).origin,
    app,
    connectedAt: Date.now(),
  };
};

/**
 * A client over one connection.
 * @param {Object} connection - as stored by claimSetupToken
 * @param {Function} [fetchImpl]
 */
export const createClient = (connection, fetchImpl = fetch) => {
  if (!connection?.accessUrl || !connection?.token) throw new MynaError('Not connected to myna.', { code: 'unauthorized' });

  const request = async (path, { method = 'GET', body } = {}) => {
    const response = await fetchImpl(`${connection.accessUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${connection.token}`,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await readJson(response);
    if (!response.ok) {
      const error = refusal(response, data);
      if (error.code === 'revoked') error.message = 'Your myna connection was revoked. Get a new setup token at mynaposter.com/connect.';
      if (error.code === 'expired') error.message = 'Your myna connection expired. Get a new setup token at mynaposter.com/connect.';
      if (error.code === 'unauthorized') error.message = 'myna does not recognise this connection. Reconnect in Settings.';
      if (error.code === 'scope') error.message = `Your myna connection lacks ${error.scope}. Make a new setup token with it ticked.`;
      if (error.code === 'writer') error.message = `myna's writer is off right now: ${data?.message || 'no model configured on the bridge'}.`;
      if (error.code === 'rate_limited') error.message = `myna asked to slow down; try again in ${error.retryAfter || 60}s.`;
      await logError('myna request refused', { path, status: response.status, code: error.code });
      throw error;
    }
    await logDebug('myna request ok', { path, method });
    return data;
  };

  return {
    info: () => request('/info'),
    accounts: () => request('/accounts'),
    analyze: (url) => request('/analyze', { method: 'POST', body: { url } }),
    write: (input) => request('/write', { method: 'POST', body: input }),
    suggest: (project) => request('/suggest', { method: 'POST', body: { project } }),
    activity: (input) => request('/activity', { method: 'POST', body: input }),
    listActivity: () => request('/activity'),
    disconnect: () => request('/', { method: 'DELETE' }),
  };
};

/* ---------------------------------------------------------- storage ---- */

/** The stored connection, or null. */
export const getConnection = async () => {
  const settings = await db.settings.get('main');
  const connection = settings?.myna;
  return connection?.accessUrl && connection?.token ? connection : null;
};

/** Keep a connection on the settings record without touching the rest of it. */
export const saveConnection = async (connection) => {
  const existing = (await db.settings.get('main')) || { id: 'main' };
  await db.settings.put({ ...existing, id: 'main', myna: connection });
};

/** Forget the connection here. Tell the bridge first when we still can. */
export const clearConnection = async ({ tellBridge = true, fetchImpl = fetch } = {}) => {
  const connection = await getConnection();
  if (connection && tellBridge) {
    try {
      await createClient(connection, fetchImpl).disconnect();
    } catch (error) {
      await logDebug('myna disconnect not acknowledged', { error: error.message });
    }
  }
  const existing = (await db.settings.get('main')) || { id: 'main' };
  const { myna: _dropped, ...rest } = existing;
  await db.settings.put({ ...rest, id: 'main' });
};

/** Paste a setup token: claim it and keep the result. */
export const connect = async (token, { fetchImpl = fetch } = {}) => {
  const connection = await claimSetupToken(token, { fetchImpl });
  await saveConnection(connection);
  return connection;
};

/** Does the stored connection carry a scope? Absent connection is no. */
export const hasScope = (connection, scope) => Boolean(connection?.scopes?.includes(scope));
