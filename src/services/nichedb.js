/**
 * nichedb.dev: the open directory the forums come from, and the place a
 * product gets submitted to.
 *
 * Reads need no key. The forums collection is every topic on the house
 * bulletin boards; a search on a product's keywords returns the boards
 * where those words are already being said, which beats a model guessing
 * subreddit names.
 */

export const NICHEDB = 'https://nichedb.dev';

/** Where to suggest a product's feed or page to the directory. */
export const submitUrl = (projectUrl, collection = '') => {
  const params = new URLSearchParams();
  if (projectUrl) params.set('url', projectUrl);
  if (collection) params.set('collection', collection);
  const query = params.toString();
  return `${NICHEDB}/submit${query ? `?${query}` : ''}`;
};

/**
 * Real forums matched on keywords, one per board and forum.
 * @param {string[]} keywords
 * @param {Function} [fetchImpl]
 * @returns {Promise<Array<{name: string, url: string}>>}
 */
export const searchForums = async (keywords, fetchImpl = fetch) => {
  const q = (keywords || [])
    .map((entry) => String(entry).trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(' ');
  if (!q) return [];
  try {
    const response = await fetchImpl(`${NICHEDB}/api/v1/search?q=${encodeURIComponent(q)}&collection=forums&limit=30`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return [];
    const data = await response.json();
    const seen = new Set();
    const forums = [];
    for (const item of data.items || []) {
      const board = item.data?.board;
      const forum = item.data?.forum;
      if (!board || !forum || !/^https?:\/\//.test(board)) continue;
      const url = `${board.replace(/\/+$/, '')}/f/${forum}`;
      if (seen.has(url)) continue;
      seen.add(url);
      forums.push({ name: `${item.data?.forumName || forum} on ${new URL(board).hostname}`, url });
    }
    return forums.slice(0, 10);
  } catch {
    // The directory is down or unreachable: no forums, not an error.
    return [];
  }
};
