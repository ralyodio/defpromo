# Content-Script Sidebar Architecture

## Overview

DefPromo now uses a **cross-browser content-script sidebar** instead of browser-specific APIs (Chrome's `sidePanel` or Firefox's `sidebar_action`). This approach provides 100% cross-browser compatibility and works on Chrome, Firefox, Edge, and Safari.

## Architecture

### Components

#### 1. Sidebar Injector (`src/content/sidebar-injector.js`)
- **Purpose**: Injects and manages the sidebar on all web pages
- **Technology**: Vanilla JavaScript with Shadow DOM for style isolation
- **Features**:
  - Creates a fixed-position container on the right side of the page
  - Uses Shadow DOM to prevent CSS conflicts with host pages
  - Manages sidebar state (open/closed, width)
  - Handles resize functionality (300-600px range)
  - Persists state across page navigations

#### 2. Sidebar React App (`src/sidebar/`)
- **Entry Point**: `src/sidebar/index.jsx`
- **HTML Template**: `src/sidebar/index.html`
- **Content**: Reuses the existing `App.jsx` from `src/sidepanel/`
- **Rendering**: Mounted inside an iframe within the Shadow DOM

#### 3. Background Service Worker (`src/background/service-worker.js`)
- **Purpose**: Handles extension icon clicks and keyboard shortcuts
- **Actions**:
  - Listens for extension icon clicks
  - Sends `TOGGLE_SIDEBAR` messages to content scripts
  - Manages initial state on installation

#### 4. Manifest Configuration (`public/manifest.json`)
- **Content Script**: Injected on all URLs (`https://*/*`, `http://*/*`)
- **Keyboard Shortcut**: `Ctrl+Shift+S` (Windows/Linux) or `Command+Shift+S` (Mac)
- **Web Accessible Resources**: Sidebar HTML, JS, and CSS files
- **Removed**: `sidePanel` permission and configuration

## User Interaction Flow

```
User Action (Icon Click or Ctrl+Shift+S)
    ↓
Background Service Worker
    ↓
Sends TOGGLE_SIDEBAR message
    ↓
Content Script (sidebar-injector.js)
    ↓
Creates/Shows/Hides Sidebar Container
    ↓
Loads React App in iframe
    ↓
Sidebar Displayed on Page
```

## Key Features

### Shadow DOM Isolation
- **Purpose**: Prevents CSS conflicts between the sidebar and host page
- **Benefits**:
  - Extension styles don't affect the page
  - Page styles don't affect the sidebar
  - Clean separation of concerns

### Resizable Sidebar
- **Min Width**: 300px
- **Max Width**: 600px
- **Default Width**: 400px
- **Interaction**: Drag handle on the left edge
- **Persistence**: Width saved to `chrome.storage.local`

### State Persistence
- **Sidebar Open/Closed**: Saved per session
- **Sidebar Width**: Saved globally
- **Storage Keys**:
  - `defpromo-sidebar-state`: boolean
  - `defpromo-sidebar-width`: number

### Animations
- **Slide In/Out**: Smooth CSS transitions using `transform: translateX()`
- **Duration**: 300ms with cubic-bezier easing
- **Resize Handle**: Hover effects for better UX

## File Structure

```
src/
├── content/
│   └── sidebar-injector.js       # Main sidebar injection logic
├── sidebar/                       # New sidebar entry point
│   ├── index.html                 # HTML template
│   └── index.jsx                  # React mounting point
├── sidepanel/                     # Original sidepanel (kept for reference)
│   ├── App.jsx                    # Main app component (reused)
│   └── views/                     # View components
└── background/
    └── service-worker.js          # Updated to handle sidebar messages
```

## Build Configuration

### Vite Config (`vite.config.js`)
```javascript
input: {
  sidebar: resolve(__dirname, 'src/sidebar/index.html'),
  'content-sidebar-injector': resolve(__dirname, 'src/content/sidebar-injector.js'),
  // ... other entries
}
```

### Output Structure
```
dist/
├── src/
│   └── sidebar/
│       ├── index.html
│       └── sidebar.js
├── content/
│   └── content-sidebar-injector.js
└── manifest.json
```

## Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome  | ✅ Full | Tested on Chrome 120+ |
| Edge    | ✅ Full | Same as Chrome (Chromium-based) |
| Firefox | ✅ Full | Works with MV3 |
| Safari  | ✅ Full | Works with MV3 |

## Advantages Over Native APIs

1. **Cross-Browser**: Works on all major browsers without platform-specific code
2. **No Permissions**: Doesn't require special `sidePanel` or `sidebar_action` permissions
3. **Flexible**: Can be customized and styled without browser limitations
4. **Consistent**: Same behavior across all browsers
5. **Portable**: Easy to adapt for other extensions

## Migration from Native SidePanel

### Removed
- `sidePanel` permission from manifest
- `side_panel` configuration from manifest
- `chrome.sidePanel.open()` calls in background script
- `default_popup` from action (now triggers sidebar instead)

### Added
- Universal content script for sidebar injection
- Keyboard command for `Ctrl+Shift+S`
- Web accessible resources for sidebar bundle
- Shadow DOM-based sidebar container
- Extension icon click handler in background script

## Development

### Building
```bash
pnpm build
```

### Testing
1. Load the extension in Chrome/Edge:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

2. Test sidebar functionality:
   - Click the extension icon → sidebar should appear
   - Press `Ctrl+Shift+S` → sidebar should toggle
   - Drag the left edge → sidebar should resize
   - Navigate to a new page → sidebar state should persist
   - Close sidebar → state should be saved

### Debugging
- **Content Script**: Check browser console on the page
- **Background Script**: Check extension service worker console
- **Sidebar App**: Check iframe console (right-click iframe → Inspect)

## Future Enhancements

- [ ] Add sidebar position option (left/right)
- [ ] Add theme customization
- [ ] Add sidebar docking/undocking
- [ ] Add multi-sidebar support
- [ ] Add sidebar minimize/maximize