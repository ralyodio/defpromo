import { describe, it, expect, vi } from 'vitest';
import { readSiteFiles, looksLikeOpenProfile, looksLikeLlms, siteFilesAsText, MAX_SITE_FILE } from '../sitefiles';

const PROFILE = '# Chovy\n\nKind: person\nWeb: https://chovy.com\n\n## Accounts\n\n- Bluesky: https://bsky.app/profile/chovy.bsky.social\n';
const LLMS = '# chovy.com\n\n> A site.\n';
const HTML = '<!doctype html><html><body># nope</body></html>';

const text = (status, body, type = 'text/plain') => ({ ok: status < 300, status, headers: { get: () => type }, text: async () => body });

describe('sitefiles', () => {
  it('classifies an OpenProfile.md and an llms.txt, and never HTML', () => {
    expect(looksLikeOpenProfile(PROFILE)).toBe(true);
    expect(looksLikeOpenProfile('# t\n\nprose')).toBe(false);
    expect(looksLikeOpenProfile(HTML)).toBe(false);
    expect(looksLikeLlms(LLMS)).toBe(true);
    expect(looksLikeLlms(HTML)).toBe(false);
  });

  it('reads both files from the origin, and a 404 or HTML answer is absent', async () => {
    const fetchImpl = vi.fn(async (url) => (url.endsWith('/.well-known/openprofile.md') ? text(200, PROFILE, 'text/markdown') : text(404, HTML, 'text/html')));
    const files = await readSiteFiles('https://chovy.com/page?x=1', fetchImpl);
    expect(fetchImpl.mock.calls.map(([url]) => url).sort()).toEqual(['https://chovy.com/.well-known/openprofile.md', 'https://chovy.com/llms.txt']);
    expect(files).toEqual({ origin: 'https://chovy.com', openprofile: PROFILE, llms: null, readFrom: ['openprofile'] });
    expect(siteFilesAsText(files)).toMatch(/^The site's own OpenProfile.md:\n# Chovy/);
  });

  it('treats a CORS or network failure as absence, cuts a huge file, and reads a bare host as https', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/llms.txt')) return text(200, LLMS + 'x'.repeat(MAX_SITE_FILE * 2));
      throw new TypeError('Failed to fetch');
    });
    const files = await readSiteFiles('chovy.com', fetchImpl);
    expect(files.origin).toBe('https://chovy.com');
    expect(files.openprofile).toBeNull();
    expect(files.llms.length).toBe(MAX_SITE_FILE);
    expect(files.readFrom).toEqual(['llms']);
    expect(siteFilesAsText({ openprofile: null, llms: null })).toBe('');
  });
});
