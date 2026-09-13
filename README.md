# DefPromo

Draft, edit and reuse social posts and replies from your product brief. DefPromo keeps projects and writing history in your browser; you review the draft and choose when to share.

## Installation

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Install-blue?logo=googlechrome)](https://chromewebstore.google.com/detail/defpromo/efdlekcpbjccbilfonhbdicfoaklanap)
[![Firefox Add-ons](https://img.shields.io/badge/Firefox-Install-orange?logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/defpromo/)

- **Chrome/Edge**: [Install from Chrome Web Store](https://chromewebstore.google.com/detail/defpromo/efdlekcpbjccbilfonhbdicfoaklanap)
- **Firefox**: [Install from Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/defpromo/)

## Features

- **Product context from OpenProfile**: reads a site's `/.well-known/openprofile.md` and `/llms.txt` before scraping. Your product's own description informs the draft.
- **Provider access through OpenConnection**: a one-time setup token grants the permissions you choose, and the connection can be revoked. [myna](https://mynaposter.com) is the currently integrated provider. You can also use your own OpenAI key.
- **Editable posts and replies**: generate variations for a project, review page context, add an optional link, edit, copy or fill a supported compose box.
- **Multiple projects**: keep each product's URL, audience, features and tone separate.
- **Places to investigate**: generated subreddit, hashtag and search ideas, plus forum results from the [NicheDB](https://nichedb.dev) directory. These are suggestions, not endorsements or permission to promote.
- **Local activity records**: form-fill counts and manually entered likes, comments and shares. They are not verified posts, reach, follower growth or platform-wide analytics.
- **Portable data**: export and import projects, drafts, settings and history as JSON. Backup files can contain credentials; keep them private.

DefPromo fills forms; it does not schedule posts or automatically publish them. Check every draft and each community's rules before sharing. Site changes can affect form filling; copying remains available.

OpenProfile/OpenConnection and NicheDB support arrived in 1.5.0. Store reviews can leave browsers on different versions; check the version offered by your store. The [publication inventory](docs/publications/README.md) records verified availability and version-matched screenshots.

## Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ralyodio/defpromo.git
   cd defpromo
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   # Build for Chrome/Edge (default)
   pnpm build
   # or
   pnpm build:chrome
   
   # Build for Firefox
   pnpm build:firefox
   
   # Build for Safari
   pnpm build:safari
   
   # Build for all browsers
   pnpm build:all
   ```
   
   **Note:** Each build automatically cleans its target directory before building, ensuring no stale code remains.

### Load in Chrome/Edge

1. Build: `pnpm build:chrome`
2. Open `chrome://extensions/` (or `edge://extensions/`)
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `dist/chrome` folder

### Load in Firefox

1. Build: `pnpm build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Navigate to `dist/firefox` and select `manifest.json`

### Load in Safari

Safari supports web extensions but requires conversion using Xcode:

1. Build: `pnpm build:safari`
2. Install Xcode from the Mac App Store
3. Run the Safari Web Extension Converter:
   ```bash
   xcrun safari-web-extension-converter dist/safari/
   ```
3. Follow the prompts to create a Safari app project
4. Open the generated Xcode project
5. Build and run the project
6. Enable the extension in Safari preferences

See [Apple's documentation](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari) for detailed instructions.

**Note:** Safari conversion creates a native macOS/iOS app wrapper around the web extension. The extension code remains the same, but distribution requires the App Store or developer signing.

## Usage

### Initial Setup

1. Click the DefPromo extension icon in your browser toolbar (or press `Ctrl+Shift+S` / `Cmd+Shift+S`)
2. The sidebar will appear on the right side of the page
3. Navigate to **Settings** tab
4. Under **Provider**, keep **myna** (the default): open [mynaposter.com/connect](https://mynaposter.com/connect), sign in, tick the scopes, copy the setup token, paste it into DefPromo and click **Connect**. The token works once and expires; myna lists DefPromo among your connected apps and can revoke it any time. From a terminal, `myna connect token` makes the same token
5. Or choose **Your own keys** and add an OpenAI key, plus a scraper key (ScrapingBee, ScraperAPI or Browserless) for sites that serve no `openprofile.md` or `llms.txt`, then click "Save Settings"

### Creating a Project

1. Go to the **Projects** tab
2. Click "+ New Project"
3. Enter:
   - Project name
   - Product URL (will be auto-scraped for details)
   - Optional description
4. Click "Create Project"

In 1.5.0+, the selected provider reads supported site files first, then uses a scraper when needed. AI turns that context into an editable project brief.

### Generating Content

1. Select a project from the **Projects** tab
2. Navigate to the **Content** tab
3. Choose content type (Post or Comment)
4. Click "Generate Variations"
5. Review and edit the generated variations
6. Select your preferred variation

### Using Content on Social Media

1. Visit any supported platform (Twitter/X, LinkedIn, Reddit, Facebook)
2. Navigate to a post or comment form
3. Look for the DefPromo auto-fill button near the form
4. Click the button to insert your generated content
5. A successful form fill is recorded locally. It is not confirmation that the platform published the content.

### Tracking activity

Open **Analytics** to review your project's form-fill counts by platform and date. You can manually enter likes, comments and shares on individual records and compare those entries. These numbers are not fetched from the platforms, and a form fill may never become a published post.

### Export/Import Data

**Export:**
1. Go to **Settings** tab
2. Click "Export All Data"
3. Save the JSON file to your preferred location

**Import:**
1. Go to **Settings** tab
2. Click "Import Data"
3. Select your previously exported JSON file
4. All data will be restored (replaces current data)

## Development

Maintainers can prepare contribution payment requests from pull-request comments
with [CoinPay commands](docs/coinpay.md). Setup, explicit recipient verification,
and a preview are documented there; no automatic per-PR charge is configured.

### Available Scripts

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage

# Lint code
pnpm lint

# Format code
pnpm format
```

### Project Structure

```
defpromo/
├── src/
│   ├── sidebar/            # Content-script sidebar (NEW)
│   │   ├── index.html      # Sidebar HTML template
│   │   └── index.jsx       # Sidebar entry point
│   ├── sidepanel/          # Main app interface
│   │   ├── App.jsx         # Main app component (reused by sidebar)
│   │   ├── views/          # View components
│   │   └── index.jsx       # Entry point
│   ├── popup/              # Browser action popup
│   ├── background/         # Background service worker
│   ├── content/            # Content scripts
│   │   ├── sidebar-injector.js  # Sidebar injection logic (NEW)
│   │   └── [platform].js   # Platform-specific scripts
│   ├── storage/            # IndexedDB layer (Dexie.js)
│   ├── services/           # API services (OpenAI, Scraper)
│   ├── components/         # Shared React components
│   └── styles/             # Global styles
├── public/
│   ├── manifest.json       # Extension manifest
│   └── icons/              # Extension icons
├── docs/
│   └── SIDEBAR_ARCHITECTURE.md  # Sidebar implementation details
└── dist/                   # Build output
```

For detailed information about the sidebar architecture, see [`docs/SIDEBAR_ARCHITECTURE.md`](docs/SIDEBAR_ARCHITECTURE.md).

## Tech Stack

- **Frontend**: React 19 + JavaScript (ES2024+)
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite 7
- **Database**: IndexedDB with Dexie.js
- **Testing**: Vitest + Testing Library
- **Charts**: Recharts
- **APIs**: OpenAI API, Web Scraper APIs

## Provider setup and costs

Connect myna in Settings with a setup token from [mynaposter.com/connect](https://mynaposter.com/connect), or select **Your own keys** and enter an OpenAI API key. With your own keys, reading a product page without supported site files also requires a configured [ScrapingBee](https://www.scrapingbee.com/), [ScraperAPI](https://www.scraperapi.com/) or [Browserless](https://www.browserless.io/) account. Provider access and usage charges are separate; installing DefPromo does not include free AI or scraping usage.

Firefox 1.4.9, while it remains the store's current version, uses your own OpenAI and scraper keys.

## Browser availability

- **Chrome/Chromium and Edge**: the Chrome Web Store listing.
- **Firefox**: the Firefox Add-ons listing; the release currently published there can lag the source release during review.
- **Safari**: a build target requiring Xcode conversion and signing. No App Store listing has been verified.

The sidebar is injected into web pages. It can be resized from 300 to 600 pixels and opened with `Ctrl+Shift+S` or `Cmd+Shift+S`. Compatibility with individual sites depends on their current forms; there is no guarantee that every platform or browser variant works.

## Privacy and data

Projects, drafts, settings, usage records and logs are stored locally in IndexedDB. Generation sends the relevant brief and reply context to your chosen provider. Product analysis sends the URL; suggestions can send keywords to NicheDB. With myna's optional `activity:write` scope, form-fill text, platform and page URL are sent to myna too.

Keys and connection tokens are stored locally, and exports can include them. See [PRIVACY.md](PRIVACY.md) for the specific recipients and actions.

## Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.
