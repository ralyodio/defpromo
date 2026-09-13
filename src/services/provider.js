/**
 * The provider: who does the thinking.
 *
 * `myna` (the default) sends every model call through the person's myna over
 * OpenConnection, so DefPromo needs no key of its own. `openai` is the older
 * way: the person's own OpenAI key, and a scraper key for pages that serve
 * no OpenProfile.md or llms.txt. The views call these three functions and
 * never know which is behind them.
 */

import { db } from '../storage/db.js';
import { scrapeAndExtract } from './scraper.js';
import { generateProjectMetadata, generateVariations, suggestSubredditsAndHashtags } from './openai.js';
import { createClient, getConnection, hasScope, MynaError, MYNA_CONNECT_URL } from './myna.js';
import { readSiteFiles, siteFilesAsText } from './sitefiles.js';
import { searchForums, submitUrl } from './nichedb.js';

export const PROVIDERS = {
  myna: 'myna',
  openai: 'openai',
};

export const DEFAULT_PROVIDER = PROVIDERS.myna;

/** The settings record with the provider resolved; myna unless the person chose otherwise. */
export const getProviderSettings = async () => {
  const settings = (await db.settings.get('main')) || {};
  const provider = settings.provider === PROVIDERS.openai ? PROVIDERS.openai : PROVIDERS.myna;
  return { ...settings, provider };
};

/**
 * Can the chosen provider do this right now? A reason the settings page can
 * show, rather than a thrown error mid-task.
 * @param {string} [scope] - the myna scope the feature needs
 */
export const providerReady = async (scope) => {
  const settings = await getProviderSettings();
  if (settings.provider === PROVIDERS.openai) {
    if (!settings.openaiKey?.trim()) return { ok: false, provider: 'openai', reason: 'Add your OpenAI API key in Settings, or switch the provider to myna.' };
    return { ok: true, provider: 'openai' };
  }
  const connection = await getConnection();
  if (!connection) return { ok: false, provider: 'myna', reason: `Connect myna in Settings: paste a setup token from ${MYNA_CONNECT_URL}.` };
  if (scope && !hasScope(connection, scope)) return { ok: false, provider: 'myna', reason: `Your myna connection lacks ${scope}. Make a new setup token with it ticked.` };
  return { ok: true, provider: 'myna', connection };
};

const requireProvider = async (scope) => {
  const state = await providerReady(scope);
  if (!state.ok) throw new MynaError(state.reason, { code: 'not-ready' });
  return state;
};

/** A project as the bridge's `write` and `suggest` take it. */
export const briefOf = (project, extra = {}) => ({
  name: project.name || '',
  description: project.description || '',
  audience: project.targetAudience || '',
  features: Array.isArray(project.keyFeatures) ? project.keyFeatures : [],
  tone: project.tone || 'professional',
  url: project.url || '',
  ...extra,
});

/**
 * A URL read into a project: name, description, audience, features, tone.
 * The site's own OpenProfile.md and llms.txt are read first, by the bridge
 * or by us; HTML is scraped only when the site says nothing about itself.
 */
export const analyzeProject = async ({ url, projectId }) => {
  const state = await requireProvider('analyze:create');

  if (state.provider === PROVIDERS.myna) {
    const copy = await createClient(state.connection).analyze(url);
    return {
      name: copy.name || '',
      description: copy.description || '',
      targetAudience: copy.audience || '',
      keyFeatures: Array.isArray(copy.features) ? copy.features : [],
      tone: copy.tone || 'professional',
      readFrom: Array.isArray(copy.read_from) ? copy.read_from : [],
      image: copy.image || null,
    };
  }

  const settings = await getProviderSettings();
  const files = await readSiteFiles(url);
  let title = '';
  let metaDescription = '';
  let pageText = siteFilesAsText(files);
  const readFrom = [...files.readFrom];

  if (!pageText) {
    if (!settings.scraperKey?.trim()) {
      throw new MynaError(
        'This site serves no OpenProfile.md or llms.txt, so reading it needs a scraper key. Add one in Settings, or switch the provider to myna.',
        { code: 'not-ready' },
      );
    }
    const extracted = await scrapeAndExtract({ url, apiKey: settings.scraperKey.trim(), service: settings.scraperService || 'browserless' });
    title = extracted.title || '';
    metaDescription = extracted.description || '';
    pageText = extracted.text || '';
    readFrom.push('html');
  }

  const metadata = await generateProjectMetadata({ apiKey: settings.openaiKey.trim(), projectId, url, title, metaDescription, pageText });
  return { ...metadata, readFrom, image: null };
};

/**
 * Post or comment variations for one platform.
 * @returns {Promise<{title: string, variations: string[]}>}
 */
export const writeVariations = async ({ project, type = 'post', platform = null, pageContext = null, includeLink = false, count = 5, generateTitle = false }) => {
  const state = await requireProvider('write:create');

  if (state.provider === PROVIDERS.myna) {
    const result = await createClient(state.connection).write({
      kind: type === 'comment' ? 'comment' : 'post',
      network: platform || null,
      count,
      project: briefOf(project),
      context: pageContext ? { title: pageContext.title || '', content: pageContext.content || '', url: pageContext.url || '' } : null,
      include_link: Boolean(includeLink),
      title: Boolean(generateTitle),
    });
    return { title: result.title || '', variations: Array.isArray(result.variations) ? result.variations : [] };
  }

  const settings = await getProviderSettings();
  const generated = await generateVariations({
    apiKey: settings.openaiKey.trim(),
    projectId: project.id,
    productName: project.name,
    description: project.description || '',
    type,
    targetAudience: project.targetAudience || '',
    tone: project.tone || 'professional',
    keyFeatures: project.keyFeatures || [],
    pageContext,
    platform,
    includeLink,
    productUrl: project.url || '',
    count,
    generateTitle,
  });
  if (Array.isArray(generated)) return { title: '', variations: generated };
  if (generated && Array.isArray(generated.variations)) return { title: generated.title || '', variations: generated.variations };
  return { title: '', variations: [String(generated)] };
};

/**
 * Where to talk about it: subreddits, hashtags, search keywords, real forums
 * from nichedb.dev, and the directory to submit the product to.
 */
export const suggestPlaces = async ({ project, keywords = '' }) => {
  const state = await requireProvider('suggest:create');
  const directories = [{ name: 'nichedb.dev', url: submitUrl(project.url || '') }];
  const named = String(keywords || '').trim();

  if (state.provider === PROVIDERS.myna) {
    const brief = briefOf(project, named ? { description: `${project.description || ''}\nKeywords the owner named: ${named}`.trim() } : {});
    const result = await createClient(state.connection).suggest(brief);
    return {
      subreddits: result.subreddits || [],
      hashtags: result.hashtags || [],
      searchKeywords: result.keywords || [],
      forums: result.forums || [],
      directories: Array.isArray(result.directories) && result.directories.length ? result.directories : directories,
    };
  }

  const settings = await getProviderSettings();
  const result = await suggestSubredditsAndHashtags({
    apiKey: settings.openaiKey.trim(),
    projectId: project.id,
    productName: project.name,
    description: project.description || '',
    targetAudience: project.targetAudience || '',
    keyFeatures: project.keyFeatures || [],
    keywords: named,
  });
  const searchKeywords = result.searchKeywords || [];
  const forums = await searchForums(searchKeywords.length ? searchKeywords : [project.name]);
  return { subreddits: result.subreddits || [], hashtags: result.hashtags || [], searchKeywords, forums, directories };
};

/**
 * Tell myna about a post made with the person's own hands, when connected
 * with the scope for it. Never throws: the post already happened.
 */
export const reportActivity = async ({ platform, type = 'post', url = '', text = '', project = '' }) => {
  try {
    const settings = await getProviderSettings();
    if (settings.provider !== PROVIDERS.myna) return false;
    const connection = await getConnection();
    if (!connection || !hasScope(connection, 'activity:write')) return false;
    await createClient(connection).activity({ network: platform, kind: type, url, text, project, at: new Date().toISOString() });
    return true;
  } catch {
    return false;
  }
};
