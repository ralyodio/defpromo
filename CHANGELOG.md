# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-09-13

### Added
- **myna as the default provider**, over [OpenConnection](https://logicsrc.com/openconnection): paste one setup token from mynaposter.com/connect, DefPromo claims it once for a scoped bearer, and myna writes posts, comments and suggestions through your own account. No OpenAI key, no scraper key. Revocable from your myna; a revoked connection says so and links back.
- **Site files before scraping**: a product's `/.well-known/openprofile.md` and `/llms.txt` are read first (by myna, or by DefPromo when using your own keys), so a site that describes itself needs no scraper at all.
- **Forums and a directory from nichedb.dev**: suggestions now include real boards where your keywords are already being discussed, and a link to submit the product to nichedb.dev.
- **Activity back to myna**: with the `activity:write` scope, a post filled in through DefPromo is reported to myna so its history and recap see it.
- Settings: a Provider card (myna by default, or your own keys), connect and disconnect, and the keys card kept for the second choice.
- Host permissions for mynaposter.com and nichedb.dev in every manifest.

### Changed
- The views call one provider facade (`src/services/provider.js`) instead of OpenAI and the scraper directly; the OpenAI and scraper services are unchanged and still serve the own-keys path.
- PRIVACY.md now says what leaves the browser under each provider.

## [1.4.0] - 2025-11-23

### Fixed
- **Cost Tracker UI**: Fixed race condition where cost tracker UI wasn't updating after API calls
  - Added 100ms delay to ensure database writes complete before reading updated costs
  - Cost data was being saved correctly but UI wasn't refreshing to display new values
  - Now properly updates when `onCostUpdate()` callback is triggered

### Changed
- **Version Bump**: Updated version from 1.3.9 to 1.4.0 across all manifests

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