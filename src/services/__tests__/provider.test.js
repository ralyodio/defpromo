import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../../storage/db';

vi.mock('../scraper.js', () => ({ scrapeAndExtract: vi.fn() }));
vi.mock('../openai.js', () => ({
  generateProjectMetadata: vi.fn(),
  generateVariations: vi.fn(),
  suggestSubredditsAndHashtags: vi.fn(),
}));
vi.mock('../sitefiles.js', async (importOriginal) => ({ ...(await importOriginal()), readSiteFiles: vi.fn() }));
vi.mock('../nichedb.js', async (importOriginal) => ({ ...(await importOriginal()), searchForums: vi.fn() }));

import { scrapeAndExtract } from '../scraper.js';
import { generateProjectMetadata, generateVariations, suggestSubredditsAndHashtags } from '../openai.js';
import { readSiteFiles } from '../sitefiles.js';
import { searchForums } from '../nichedb.js';
import { analyzeProject, writeVariations, suggestPlaces, providerReady, reportActivity, briefOf, DEFAULT_PROVIDER } from '../provider';

const CONNECTION = {
  accessUrl: 'https://mynaposter.com/api/openconnection/v1',
  token: 'oc_t',
  scopes: ['analyze:create', 'write:create', 'suggest:create', 'activity:write'],
};

const reply = (status, body) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body });

const project = { id: 'proj-1', name: 'myna', description: 'posts from the terminal', targetAudience: 'devs', keyFeatures: ['a'], tone: 'casual', url: 'https://mynaposter.com' };

describe('provider', () => {
  let fetchSpy;
  beforeEach(async () => {
    await db.settings.clear();
    vi.clearAllMocks();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  it('is myna by default and says how to connect', async () => {
    expect(DEFAULT_PROVIDER).toBe('myna');
    const state = await providerReady('write:create');
    expect(state).toMatchObject({ ok: false, provider: 'myna' });
    expect(state.reason).toMatch(/mynaposter.com\/connect/);
    await db.settings.put({ id: 'main', myna: { ...CONNECTION, scopes: ['write:create'] } });
    expect((await providerReady('write:create')).ok).toBe(true);
    expect((await providerReady('suggest:create')).reason).toMatch(/lacks suggest:create/);
  });

  it('analyzeProject over myna maps the bridge’s answer onto the project shape', async () => {
    await db.settings.put({ id: 'main', myna: CONNECTION });
    fetchSpy.mockResolvedValue(reply(200, { name: 'myna', description: 'd', audience: 'devs', features: ['x'], tone: 'technical', read_from: ['openprofile', 'html'], image: null }));
    const result = await analyzeProject({ url: 'https://mynaposter.com', projectId: 'p' });
    expect(result).toEqual({ name: 'myna', description: 'd', targetAudience: 'devs', keyFeatures: ['x'], tone: 'technical', readFrom: ['openprofile', 'html'], image: null });
    expect(fetchSpy.mock.calls[0][0]).toBe('https://mynaposter.com/api/openconnection/v1/analyze');
    expect(scrapeAndExtract).not.toHaveBeenCalled();
  });

  it('analyzeProject with your own key reads the site’s files first and never scrapes when they answer', async () => {
    await db.settings.put({ id: 'main', provider: 'openai', openaiKey: ' sk-1 ' });
    readSiteFiles.mockResolvedValue({ origin: 'https://x.com', openprofile: '# X\n\nKind: person\n', llms: null, readFrom: ['openprofile'] });
    generateProjectMetadata.mockResolvedValue({ name: 'X', description: 'd', targetAudience: 't', keyFeatures: [], tone: 'friendly' });
    const result = await analyzeProject({ url: 'https://x.com', projectId: 'p' });
    expect(result).toMatchObject({ name: 'X', readFrom: ['openprofile'] });
    expect(scrapeAndExtract).not.toHaveBeenCalled();
    expect(generateProjectMetadata.mock.calls[0][0]).toMatchObject({ apiKey: 'sk-1', pageText: expect.stringContaining("OpenProfile.md") });
  });

  it('analyzeProject with your own key scrapes only when the site says nothing, and needs a scraper key then', async () => {
    await db.settings.put({ id: 'main', provider: 'openai', openaiKey: 'sk-1' });
    readSiteFiles.mockResolvedValue({ origin: 'https://x.com', openprofile: null, llms: null, readFrom: [] });
    await expect(analyzeProject({ url: 'https://x.com', projectId: 'p' })).rejects.toThrow(/scraper key/);

    await db.settings.put({ id: 'main', provider: 'openai', openaiKey: 'sk-1', scraperKey: 'bee', scraperService: 'scrapingbee' });
    scrapeAndExtract.mockResolvedValue({ title: 'T', description: 'D', text: 'body' });
    generateProjectMetadata.mockResolvedValue({ name: 'X', description: 'd', targetAudience: '', keyFeatures: [], tone: 'professional' });
    const result = await analyzeProject({ url: 'https://x.com', projectId: 'p' });
    expect(scrapeAndExtract).toHaveBeenCalledWith({ url: 'https://x.com', apiKey: 'bee', service: 'scrapingbee' });
    expect(result.readFrom).toEqual(['html']);
  });

  it('writeVariations over myna sends the brief, the network and the context, and normalises the answer', async () => {
    await db.settings.put({ id: 'main', myna: CONNECTION });
    fetchSpy.mockResolvedValue(reply(200, { title: 'T', variations: ['one', 'two'], network: 'x' }));
    const result = await writeVariations({ project, type: 'comment', platform: 'twitter', pageContext: { title: 'p', content: 'c' }, includeLink: true, count: 2, generateTitle: true });
    expect(result).toEqual({ title: 'T', variations: ['one', 'two'] });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toEqual({ kind: 'comment', network: 'twitter', count: 2, project: briefOf(project), context: { title: 'p', content: 'c', url: '' }, include_link: true, title: true });
  });

  it('writeVariations with your own key normalises an array or a titled object', async () => {
    await db.settings.put({ id: 'main', provider: 'openai', openaiKey: 'sk-1' });
    generateVariations.mockResolvedValueOnce(['a', 'b']);
    expect(await writeVariations({ project })).toEqual({ title: '', variations: ['a', 'b'] });
    generateVariations.mockResolvedValueOnce({ title: 'T', variations: ['c'] });
    expect(await writeVariations({ project, generateTitle: true })).toEqual({ title: 'T', variations: ['c'] });
  });

  it('suggestPlaces over myna returns forums and a submit link; with your own key the forums come from nichedb', async () => {
    await db.settings.put({ id: 'main', myna: CONNECTION });
    fetchSpy.mockResolvedValue(reply(200, { subreddits: ['selfhosted'], hashtags: ['indiehackers'], keywords: ['post from terminal'], forums: [{ name: 'f', url: 'https://tsbb.dev/f/x' }] }));
    const viaMyna = await suggestPlaces({ project, keywords: 'terminal' });
    expect(viaMyna).toMatchObject({ subreddits: ['selfhosted'], searchKeywords: ['post from terminal'], forums: [{ url: 'https://tsbb.dev/f/x' }] });
    expect(viaMyna.directories[0].url).toBe('https://nichedb.dev/submit?url=https%3A%2F%2Fmynaposter.com');
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).project.description).toMatch(/Keywords the owner named: terminal/);

    await db.settings.put({ id: 'main', provider: 'openai', openaiKey: 'sk-1' });
    suggestSubredditsAndHashtags.mockResolvedValue({ subreddits: ['a'], hashtags: ['b'], searchKeywords: ['c'] });
    searchForums.mockResolvedValue([{ name: 'n', url: 'https://bbs.hqtui.com/f/news' }]);
    const viaKey = await suggestPlaces({ project });
    expect(searchForums).toHaveBeenCalledWith(['c']);
    expect(viaKey.forums).toEqual([{ name: 'n', url: 'https://bbs.hqtui.com/f/news' }]);
  });

  it('reportActivity posts to myna only when connected with the scope, and never throws', async () => {
    expect(await reportActivity({ platform: 'reddit' })).toBe(false);
    await db.settings.put({ id: 'main', myna: { ...CONNECTION, scopes: ['write:create'] } });
    expect(await reportActivity({ platform: 'reddit' })).toBe(false);
    await db.settings.put({ id: 'main', myna: CONNECTION });
    fetchSpy.mockResolvedValue(reply(201, { id: 'act' }));
    expect(await reportActivity({ platform: 'reddit', type: 'comment', url: 'https://reddit.com/x', text: 'hi', project: 'myna' })).toBe(true);
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body)).toMatchObject({ network: 'reddit', kind: 'comment', url: 'https://reddit.com/x', project: 'myna' });
    fetchSpy.mockRejectedValue(new Error('down'));
    expect(await reportActivity({ platform: 'reddit' })).toBe(false);
  });
});
