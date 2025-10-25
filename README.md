# DefNotPromo

AI-powered social media self-promotion assistant with comprehensive analytics and A/B testing capabilities.

## Features

- 🤖 **AI Content Generation**: Generate multiple promotional content variations using OpenAI
- 📊 **Analytics Dashboard**: Track performance across platforms with detailed metrics
- 🔄 **A/B Testing**: Compare content variation performance
- 💾 **Data Portability**: Export/import all data as JSON for cross-browser/machine use
- 🎯 **Multi-Project Management**: Manage multiple products simultaneously
- 🌐 **Cross-Platform**: Supports 10 platforms - Twitter/X, LinkedIn, Reddit, Facebook, Stacker News, Bluesky, Primal.net, Slack, Discord, and Telegram
- 📱 **Dual Interface**: Side panel for full features + popup for quick actions

## Installation

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ralyodio/defnotpromo.git
   cd defnotpromo
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Build the extension**
   ```bash
   pnpm build
   ```

### Load in Chrome/Edge

1. Open `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `dist` folder from this project

### Load in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Navigate to the `dist` folder and select `manifest.json`

### Load in Safari

Safari supports web extensions but requires conversion using Xcode:

1. Install Xcode from the Mac App Store
2. Run the Safari Web Extension Converter:
   ```bash
   xcrun safari-web-extension-converter dist/
   ```
3. Follow the prompts to create a Safari app project
4. Open the generated Xcode project
5. Build and run the project
6. Enable the extension in Safari preferences

See [Apple's documentation](https://developer.apple.com/documentation/safariservices/safari_web_extensions/converting_a_web_extension_for_safari) for detailed instructions.

**Note:** Safari conversion creates a native macOS/iOS app wrapper around the web extension. The extension code remains the same, but distribution requires the App Store or developer signing.

## Usage

### Initial Setup

1. Click the DefNotPromo extension icon in your browser toolbar
2. Click "Open Side Panel" to access the full interface
3. Navigate to **Settings** tab
4. Add your API keys:
   - **OpenAI API Key**: Required for AI content generation
   - **Web Scraper API Key**: Required for automatic product information extraction
   - Choose your preferred scraper service (ScrapingBee, ScraperAPI, or Browserless)
5. Click "Save Settings"

### Creating a Project

1. Go to the **Projects** tab
2. Click "+ New Project"
3. Enter:
   - Project name
   - Product URL (will be auto-scraped for details)
   - Optional description
4. Click "Create Project"

The extension will automatically scrape your product page and use AI to extract key information.

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
3. Look for the DefNotPromo auto-fill button near the form
4. Click the button to insert your generated content
5. The extension automatically tracks this submission in analytics

### Tracking Analytics

1. Navigate to the **Analytics** tab
2. View comprehensive metrics:
   - Total submissions by platform
   - Time-series charts
   - Platform comparisons
   - Best performing content
   - A/B testing insights
3. Manually update engagement metrics (likes, comments, shares) for tracked content

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
defnotpromo/
├── src/
│   ├── sidepanel/          # Main side panel interface
│   │   ├── App.jsx         # Main app component
│   │   ├── views/          # View components
│   │   └── index.jsx       # Entry point
│   ├── popup/              # Browser action popup
│   ├── background/         # Background service worker
│   ├── content/            # Content scripts per platform
│   ├── storage/            # IndexedDB layer (Dexie.js)
│   ├── services/           # API services (OpenAI, Scraper)
│   ├── components/         # Shared React components
│   └── styles/             # Global styles
├── public/
│   ├── manifest.json       # Extension manifest
│   └── icons/              # Extension icons
└── dist/                   # Build output
```

## Tech Stack

- **Frontend**: React 19 + JavaScript (ES2024+)
- **Styling**: Tailwind CSS v4
- **Build Tool**: Vite 7
- **Database**: IndexedDB with Dexie.js
- **Testing**: Vitest + Testing Library
- **Charts**: Recharts
- **APIs**: OpenAI API, Web Scraper APIs

## API Requirements

### OpenAI API

Get your API key from [OpenAI Platform](https://platform.openai.com/api-keys)

### Web Scraper Services

Choose one:
- **ScrapingBee**: [https://www.scrapingbee.com/](https://www.scrapingbee.com/) - $49/mo for 100k credits
- **ScraperAPI**: [https://www.scraperapi.com/](https://www.scraperapi.com/) - $49/mo for 100k calls
- **Browserless**: [https://www.browserless.io/](https://www.browserless.io/) - $29/mo for 10k requests

## Browser Compatibility

- ✅ Chrome/Chromium (Manifest V3)
- ✅ Edge (Manifest V3)
- ✅ Firefox (with manifest adjustments)
- ⚠️ Safari (requires conversion with Xcode)

## Privacy & Security

- All data stored locally in IndexedDB
- No data sent to external servers except user-configured APIs (OpenAI, Web Scraper)
- API keys stored securely in browser storage
- Export files contain sensitive data - handle with care

## Contributing

This is a personal project, but suggestions and bug reports are welcome via GitHub issues.

## License

ISC

## Support

For issues or questions, please open an issue on GitHub.