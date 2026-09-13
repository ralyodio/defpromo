/**
 * What a site says about itself, read before anything scrapes it.
 *
 * `/.well-known/openprofile.md` (https://logicsrc.com/openprofile) is who the
 * site is and where else it lives; `/llms.txt` is what it wants a model to
 * know. Both are optional, both are read from the origin of the product URL,
 * and a missing one is absent rather than an error. With the myna provider
 * the bridge does this itself; with your own keys DefPromo does it here, and
 * a site that serves either file needs no scraper at all.
 */

/** Enough for a profile or an llms.txt; a file past this is cut, not refused. */
export const MAX_SITE_FILE = 16000;

const HTML = /^\s*<(!doctype|html|head|body)/i;

/** An OpenProfile.md starts with a heading and has a section or an identity line. */
export const looksLikeOpenProfile = (text) => {
  if (!text || HTML.test(text)) return false;
  const head = text.slice(0, 400);
  return /^#\s+\S/m.test(head) && (/^##\s+\S/m.test(text) || /^(Web|Kind|Name|Handle):/m.test(text));
};

/** llms.txt is Markdown with a title. Never HTML. */
export const looksLikeLlms = (text) => {
  if (!text || HTML.test(text)) return false;
  return /^#\s+\S/m.test(text.slice(0, 400));
};

const readText = async (url, fetchImpl, timeoutMs) => {
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.1' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const type = response.headers?.get?.('content-type') || '';
    if (/json|image|octet-stream/i.test(type)) return null;
    const text = await response.text();
    return text.slice(0, MAX_SITE_FILE);
  } catch {
    // Not served, blocked by CORS, or down. All the same: absent.
    return null;
  }
};

/**
 * Read both files from the page's origin.
 * @param {string} pageUrl
 * @param {Function} [fetchImpl]
 * @param {number} [timeoutMs]
 * @returns {Promise<{origin: string, openprofile: string|null, llms: string|null, readFrom: string[]}>}
 */
export const readSiteFiles = async (pageUrl, fetchImpl = fetch, timeoutMs = 8000) => {
  const target = /^https?:\/\//.test(pageUrl) ? pageUrl : `https://${pageUrl}`;
  const origin = new URL(target).origin;
  const [profile, llms] = await Promise.all([
    readText(`${origin}/.well-known/openprofile.md`, fetchImpl, timeoutMs),
    readText(`${origin}/llms.txt`, fetchImpl, timeoutMs),
  ]);
  const files = { origin, openprofile: null, llms: null, readFrom: [] };
  if (profile && looksLikeOpenProfile(profile)) {
    files.openprofile = profile;
    files.readFrom.push('openprofile');
  }
  if (llms && looksLikeLlms(llms)) {
    files.llms = llms;
    files.readFrom.push('llms');
  }
  return files;
};

/**
 * The site files as page text the metadata prompt can read, with the
 * profile first because the site's own words outrank a scrape.
 */
export const siteFilesAsText = (files) =>
  [files?.openprofile && `The site's own OpenProfile.md:\n${files.openprofile}`, files?.llms && `The site's llms.txt:\n${files.llms}`]
    .filter(Boolean)
    .join('\n\n');
