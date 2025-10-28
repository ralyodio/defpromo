/**
 * Content Script Sidebar Injector
 * Injects a cross-browser sidebar using Shadow DOM for style isolation
 */

const SIDEBAR_ID = 'defpromo-sidebar-root';
const SIDEBAR_WIDTH_KEY = 'defpromo-sidebar-width';
const SIDEBAR_STATE_KEY = 'defpromo-sidebar-state';
const MIN_WIDTH = 300;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 400;

class SidebarInjector {
  constructor() {
    this.container = null;
    this.shadowRoot = null;
    this.iframe = null;
    this.resizeHandle = null;
    this.isResizing = false;
    this.currentWidth = DEFAULT_WIDTH;
    this.isVisible = false;
    
    this.init();
  }

  async init() {
    // Load saved state
    await this.loadState();
    
    // Listen for messages from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TOGGLE_SIDEBAR') {
        this.toggle();
        sendResponse({ success: true, visible: this.isVisible });
      } else if (message.type === 'OPEN_SIDEBAR') {
        this.show();
        sendResponse({ success: true, visible: true });
      }
      return true;
    });

    // Create sidebar if it was previously open
    if (this.isVisible) {
      this.createSidebar();
    }
  }

  async loadState() {
    try {
      const result = await chrome.storage.local.get([SIDEBAR_WIDTH_KEY, SIDEBAR_STATE_KEY]);
      this.currentWidth = result[SIDEBAR_WIDTH_KEY] || DEFAULT_WIDTH;
      this.isVisible = result[SIDEBAR_STATE_KEY] || false;
    } catch (error) {
      console.error('Failed to load sidebar state:', error);
    }
  }

  async saveState() {
    try {
      await chrome.storage.local.set({
        [SIDEBAR_WIDTH_KEY]: this.currentWidth,
        [SIDEBAR_STATE_KEY]: this.isVisible,
      });
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  }

  createSidebar() {
    if (this.container) {
      return; // Already created
    }

    // Create container
    this.container = document.createElement('div');
    this.container.id = SIDEBAR_ID;
    
    // Create shadow root for style isolation
    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    // Add styles
    const style = document.createElement('style');
    style.textContent = this.getStyles();
    this.shadowRoot.appendChild(style);

    // Create sidebar wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'defpromo-sidebar-wrapper';
    wrapper.style.width = `${this.currentWidth}px`;

    // Create resize handle
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.className = 'defpromo-resize-handle';
    this.resizeHandle.addEventListener('mousedown', this.startResize.bind(this));
    wrapper.appendChild(this.resizeHandle);

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.className = 'defpromo-close-button';
    closeButton.innerHTML = '×';
    closeButton.title = 'Close sidebar (Ctrl+Shift+S)';
    closeButton.addEventListener('click', () => this.hide());
    wrapper.appendChild(closeButton);

    // Create iframe for React app
    this.iframe = document.createElement('iframe');
    this.iframe.className = 'defpromo-sidebar-iframe';
    
    // Get the sidebar HTML URL from web_accessible_resources
    const sidebarUrl = chrome.runtime.getURL('src/sidebar/index.html');
    this.iframe.src = sidebarUrl;
    
    wrapper.appendChild(this.iframe);
    this.shadowRoot.appendChild(wrapper);

    // Add to page
    document.documentElement.appendChild(this.container);

    // Add animation class
    setTimeout(() => {
      wrapper.classList.add('visible');
    }, 10);
  }

  getStyles() {
    return `
      :host {
        all: initial;
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
      }

      .defpromo-sidebar-wrapper {
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        background: white;
        box-shadow: -2px 0 8px rgba(0, 0, 0, 0.15);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: text;
        -webkit-user-select: text;
        -moz-user-select: text;
        -ms-user-select: text;
      }

      .defpromo-sidebar-wrapper.visible {
        transform: translateX(0);
      }

      .defpromo-resize-handle {
        position: absolute;
        left: 0;
        top: 0;
        width: 8px;
        height: 100%;
        cursor: ew-resize;
        background: transparent;
        z-index: 10;
        transition: background-color 0.2s;
      }

      .defpromo-resize-handle:hover {
        background: rgba(14, 165, 233, 0.3);
      }

      .defpromo-resize-handle:active {
        background: rgba(14, 165, 233, 0.5);
      }

      .defpromo-close-button {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        border: none;
        background: rgba(0, 0, 0, 0.05);
        color: #666;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
        border-radius: 6px;
        z-index: 11;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .defpromo-close-button:hover {
        background: rgba(0, 0, 0, 0.1);
        color: #333;
      }

      .defpromo-sidebar-iframe {
        width: 100%;
        height: 100%;
        border: none;
        background: white;
      }
    `;
  }

  startResize(e) {
    e.preventDefault();
    this.isResizing = true;
    
    const startX = e.clientX;
    const startWidth = this.currentWidth;

    const handleMouseMove = (e) => {
      if (!this.isResizing) return;

      const deltaX = startX - e.clientX;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + deltaX));
      
      this.currentWidth = newWidth;
      const wrapper = this.shadowRoot.querySelector('.defpromo-sidebar-wrapper');
      if (wrapper) {
        wrapper.style.width = `${newWidth}px`;
      }
    };

    const handleMouseUp = () => {
      this.isResizing = false;
      this.saveState();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  show() {
    if (!this.container) {
      this.createSidebar();
    }
    
    this.isVisible = true;
    this.saveState();

    const wrapper = this.shadowRoot?.querySelector('.defpromo-sidebar-wrapper');
    if (wrapper) {
      wrapper.classList.add('visible');
    }
  }

  hide() {
    this.isVisible = false;
    this.saveState();

    const wrapper = this.shadowRoot?.querySelector('.defpromo-sidebar-wrapper');
    if (wrapper) {
      wrapper.classList.remove('visible');
    }
  }

  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.shadowRoot = null;
    this.iframe = null;
  }
}

// Initialize sidebar injector
const sidebarInjector = new SidebarInjector();

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (sidebarInjector) {
    sidebarInjector.saveState();
  }
});