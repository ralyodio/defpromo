# Changelog

All notable changes to this project will be documented in this file.

## [1.3.9] - 2025-11-23

### Fixed
- **Reddit Context Extraction**: Fixed post body parsing to correctly extract content from the current post instead of pulling from other posts or comments
  - Now scopes selectors to the main post container (`shreddit-post[tabindex="-1"]`)
  - Added fallback chain for different Reddit layouts
  - Improved selector specificity to avoid conflicts with comment sections

### Added
- **Tests**: Comprehensive test suite for Reddit context extraction (`src/content/__tests__/reddit.test.js`)
  - 9 test cases covering modern Reddit layouts, fallback behavior, content limiting, whitespace handling, and error handling
  - Uses Vitest with JSDOM for DOM simulation
  - All tests passing ✓

### Changed
- **Version Bump**: Updated version from 1.3.8 to 1.3.9 across all manifests
  - `package.json`
  - `public/manifest.json` (Chrome)
  - `public/manifest.firefox.json` (Firefox)
  - `public/manifest.safari.json` (Safari)

### Technical Details

#### Reddit Context Extraction Strategy
The new implementation uses a two-phase approach:

1. **Find Main Post Container**: Locates the primary post using multiple selectors:
   - `shreddit-post[tabindex="-1"]` - Focused post
   - `shreddit-post:not([id*="comment"])` - Non-comment posts
   - `main shreddit-post` - Post in main content area

2. **Extract Content from Container**: Once found, extracts title and content using scoped selectors:
   - Title: `h1[id^="post-title-"]` or `h1`
   - Content: `div[slot="text-body"]`, `[id$="-post-rtjson-content"]`, `.text-neutral-content`, or `[data-click-id="text"]`

3. **Fallback**: If main container not found, searches within `main` element

This ensures the extension always extracts content from the correct post, not from comments or other posts on the page.

#### Test Coverage
- Modern Reddit layout with `shreddit-post` elements
- Alternative content selectors (rtjson, class-based)
- Comment post filtering
- Fallback behavior when main container not found
- Content length limiting (1000 chars)
- Whitespace trimming
- Error handling

## [1.3.8] - Previous Release
(Previous changes...)