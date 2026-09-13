import { describe, it, expect, vi } from 'vitest';
import { searchForums, submitUrl } from '../nichedb';

const json = (status, body) => ({ ok: status < 300, status, json: async () => body });

describe('nichedb', () => {
  it('builds the submit link with the product URL and an optional collection', () => {
    expect(submitUrl('https://mynaposter.com')).toBe('https://nichedb.dev/submit?url=https%3A%2F%2Fmynaposter.com');
    expect(submitUrl('https://x.com', 'saas')).toBe('https://nichedb.dev/submit?url=https%3A%2F%2Fx.com&collection=saas');
    expect(submitUrl('')).toBe('https://nichedb.dev/submit');
  });

  it('searches the forums collection and returns one entry per board and forum', async () => {
    const fetchImpl = vi.fn(async (url) => {
      expect(url).toBe('https://nichedb.dev/api/v1/search?q=self%20hosting%20podcast&collection=forums&limit=30');
      return json(200, {
        items: [
          { data: { board: 'https://tsbb.dev', forum: 'announcements', forumName: 'Announcements' } },
          { data: { board: 'https://tsbb.dev', forum: 'announcements', forumName: 'Announcements' } },
          { data: { board: 'https://bbs.hqtui.com/', forum: 'news' } },
          { data: {} },
        ],
      });
    });
    expect(await searchForums(['self hosting', 'podcast'], fetchImpl)).toEqual([
      { name: 'Announcements on tsbb.dev', url: 'https://tsbb.dev/f/announcements' },
      { name: 'news on bbs.hqtui.com', url: 'https://bbs.hqtui.com/f/news' },
    ]);
  });

  it('answers an empty list for no keywords, an outage, or a refusal', async () => {
    expect(await searchForums([], vi.fn())).toEqual([]);
    expect(await searchForums(['x'], vi.fn(async () => json(503, {})))).toEqual([]);
    expect(await searchForums(['x'], vi.fn(async () => { throw new Error('down'); }))).toEqual([]);
  });
});
