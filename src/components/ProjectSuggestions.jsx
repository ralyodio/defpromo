import React, { useState } from 'react';

/**
 * Reusable component for displaying project suggestions (subreddits, hashtags, search keywords)
 * @param {Object} props
 * @param {string[]} props.subreddits - Array of subreddit names
 * @param {string[]} props.hashtags - Array of hashtag strings
 * @param {string[]} props.searchKeywords - Array of search keyword strings
 * @param {Function} props.onCopy - Callback function for copying text
 * @param {boolean} props.compact - Whether to use compact styling (default: false)
 * @param {boolean} props.editable - Whether to show edit controls (default: false)
 * @param {Function} props.onRemoveSubreddit - Callback to remove a subreddit
 * @param {Function} props.onRemoveHashtag - Callback to remove a hashtag
 * @param {Function} props.onRemoveKeyword - Callback to remove a keyword
 * @param {Function} props.onAddSubreddit - Callback to add a subreddit
 * @param {Function} props.onAddHashtag - Callback to add a hashtag
 * @param {Function} props.onAddKeyword - Callback to add a keyword
 */
const ProjectSuggestions = ({ 
  subreddits = [], 
  hashtags = [], 
  searchKeywords = [], 
  onCopy,
  compact = false,
  editable = false,
  onRemoveSubreddit,
  onRemoveHashtag,
  onRemoveKeyword,
  onAddSubreddit,
  onAddHashtag,
  onAddKeyword,
}) => {
  const [newSubreddit, setNewSubreddit] = useState('');
  const [newHashtag, setNewHashtag] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const hasAnySuggestions = subreddits.length > 0 || hashtags.length > 0 || searchKeywords.length > 0;

  // In editable mode, always show the component so users can add items
  if (!hasAnySuggestions && !editable) {
    return null;
  }

  const sizeClasses = compact ? 'text-xs px-2 py-0.5' : 'text-sm px-2 py-1';
  const iconSize = compact ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const gapClass = compact ? 'gap-1' : 'gap-2';

  const handleAddSubreddit = (e) => {
    e.preventDefault();
    if (newSubreddit.trim() && onAddSubreddit) {
      // Remove r/ prefix if user included it
      const cleaned = newSubreddit.trim().replace(/^r\//, '');
      onAddSubreddit(cleaned);
      setNewSubreddit('');
    }
  };

  const handleAddHashtag = (e) => {
    e.preventDefault();
    if (newHashtag.trim() && onAddHashtag) {
      // Remove # prefix if user included it
      const cleaned = newHashtag.trim().replace(/^#/, '');
      onAddHashtag(cleaned);
      setNewHashtag('');
    }
  };

  const handleAddKeyword = (e) => {
    e.preventDefault();
    if (newKeyword.trim() && onAddKeyword) {
      onAddKeyword(newKeyword.trim());
      setNewKeyword('');
    }
  };

  return (
    <div className="space-y-3">
      {/* Subreddits */}
      {(subreddits.length > 0 || editable) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-medium text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              Subreddits:
            </span>
            {onCopy && subreddits.length > 0 && (
              <button
                onClick={() => onCopy(subreddits.map(s => `r/${s}`).join('\n'))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy All
              </button>
            )}
          </div>
          <div className={`flex flex-wrap ${gapClass}`}>
            {subreddits.map((subreddit) => (
              <div
                key={subreddit}
                className={`inline-flex items-center ${sizeClasses} bg-orange-50 hover:bg-orange-100 text-orange-700 rounded font-medium transition-colors`}
              >
                <a
                  href={`https://reddit.com/r/${subreddit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  r/{subreddit}
                </a>
                {editable && onRemoveSubreddit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSubreddit(subreddit);
                    }}
                    className="ml-1 text-orange-500 hover:text-orange-700 font-bold"
                    title="Remove subreddit"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && onAddSubreddit && (
            <form onSubmit={handleAddSubreddit} className="mt-2 flex gap-1">
              <input
                type="text"
                value={newSubreddit}
                onChange={(e) => setNewSubreddit(e.target.value)}
                placeholder="Add subreddit..."
                className="text-xs px-2 py-1 border border-gray-300 rounded flex-1 min-w-0"
              />
              <button
                type="submit"
                className="text-xs px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded"
              >
                +
              </button>
            </form>
          )}
        </div>
      )}

      {/* Hashtags */}
      {(hashtags.length > 0 || editable) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-medium text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              Hashtags:
            </span>
            {onCopy && hashtags.length > 0 && (
              <button
                onClick={() => onCopy(hashtags.map(h => `#${h}`).join(' '))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy All
              </button>
            )}
          </div>
          <div className={`flex flex-wrap ${gapClass}`}>
            {hashtags.map((hashtag) => (
              <div 
                key={hashtag} 
                className={`inline-flex items-center gap-1 ${sizeClasses} bg-blue-50 text-blue-700 rounded font-medium`}
              >
                <span>#{hashtag}</span>
                <div className="flex gap-0.5 ml-1">
                  <a
                    href={`https://x.com/search?q=%23${hashtag}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on X/Twitter"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </a>
                  <a
                    href={`https://www.instagram.com/explore/tags/${hashtag}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on Instagram"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </a>
                  <a
                    href={`https://www.threads.net/search?q=%23${hashtag}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on Threads"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142l-.126 1.974a11.881 11.881 0 00-2.64-.123c-1.039.06-1.93.36-2.5.84-.482.406-.723.923-.679 1.455.04.48.326.896.804 1.17.563.323 1.32.48 2.25.467 1.15-.062 2.03-.48 2.61-1.24.475-.624.764-1.483.859-2.552l.057-.97 2.024.114c.102.006.2.014.295.023.582.055 1.113.136 1.628.25 1.36.302 2.536.763 3.497 1.372 1.155.732 1.985 1.68 2.467 2.817.136.322.244.656.323 1.001.434 1.892.217 4.007-1.285 6.018-1.442 1.93-3.544 2.9-6.25 2.882z"/>
                    </svg>
                  </a>
                  <a
                    href={`https://www.tiktok.com/search?q=%23${hashtag}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on TikTok"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                  </a>
                </div>
                {editable && onRemoveHashtag && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveHashtag(hashtag);
                    }}
                    className="ml-1 text-blue-500 hover:text-blue-700 font-bold"
                    title="Remove hashtag"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && onAddHashtag && (
            <form onSubmit={handleAddHashtag} className="mt-2 flex gap-1">
              <input
                type="text"
                value={newHashtag}
                onChange={(e) => setNewHashtag(e.target.value)}
                placeholder="Add hashtag..."
                className="text-xs px-2 py-1 border border-gray-300 rounded flex-1 min-w-0"
              />
              <button
                type="submit"
                className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
              >
                +
              </button>
            </form>
          )}
        </div>
      )}

      {/* Search Keywords */}
      {(searchKeywords.length > 0 || editable) && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`font-medium text-gray-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              Search Keywords:
            </span>
            {onCopy && searchKeywords.length > 0 && (
              <button
                onClick={() => onCopy(searchKeywords.join(', '))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy All
              </button>
            )}
          </div>
          <div className={`flex flex-wrap ${gapClass}`}>
            {searchKeywords.map((keyword) => (
              <div 
                key={keyword} 
                className={`inline-flex items-center gap-1 ${sizeClasses} bg-gray-50 text-gray-700 rounded border border-gray-200`}
              >
                <span>{keyword}</span>
                <div className="flex gap-0.5 ml-1">
                  <a
                    href={`https://www.facebook.com/search/top?q=${encodeURIComponent(keyword)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on Facebook"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </a>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on YouTube"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </a>
                  <a
                    href={`https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(keyword)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:opacity-70"
                    title="Search on LinkedIn"
                  >
                    <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                </div>
                {editable && onRemoveKeyword && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveKeyword(keyword);
                    }}
                    className="ml-1 text-gray-500 hover:text-gray-700 font-bold"
                    title="Remove keyword"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          {editable && onAddKeyword && (
            <form onSubmit={handleAddKeyword} className="mt-2 flex gap-1">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add keyword..."
                className="text-xs px-2 py-1 border border-gray-300 rounded flex-1 min-w-0"
              />
              <button
                type="submit"
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
              >
                +
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectSuggestions;
