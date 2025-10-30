/**
 * Shared utilities for content scripts
 * Common functionality used across all platform content scripts
 */

/**
 * Create and inject the DefPromo auto-fill button
 * @param {HTMLElement} targetElement - The form element to attach the button to
 * @param {string} platform - Platform name (e.g., 'twitter', 'reddit')
 * @param {string} type - Content type ('post' or 'comment')
 * @param {Function} fillCallback - Callback function to fill the form with content
 */
export const injectAutoFillButton = (targetElement, platform, type, fillCallback) => {
  if (targetElement.dataset.defpromoInjected) {
    return; // Already injected
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'defpromo-button-container';
  buttonContainer.style.cssText = 'margin: 8px 0;';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'defpromo-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px; vertical-align: middle;">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
    </svg>
    <span>Fill with DefPromo</span>
  `;
  button.style.cssText = `
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.background = '#0284c7';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#0ea5e9';
  });

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    button.disabled = true;
    button.innerHTML = '<span>Loading...</span>';
    
    try {
      await handleAutoFill(platform, type, fillCallback);
      button.innerHTML = '<span>✓ Filled!</span>';
      setTimeout(() => {
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px; vertical-align: middle;">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
          </svg>
          <span>Fill with DefPromo</span>
        `;
        button.disabled = false;
      }, 2000);
    } catch (error) {
      button.innerHTML = '<span>✗ Error</span>';
      button.style.background = '#dc2626';
      setTimeout(() => {
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px; vertical-align: middle;">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
          </svg>
          <span>Fill with DefPromo</span>
        `;
        button.style.background = '#0ea5e9';
        button.disabled = false;
      }, 2000);
    }
  });

  buttonContainer.appendChild(button);
  targetElement.parentNode.insertBefore(buttonContainer, targetElement.nextSibling);
  targetElement.dataset.defpromoInjected = 'true';
};

/**
 * Handle auto-fill functionality
 * @param {string} platform - Platform name
 * @param {string} type - Content type
 * @param {Function} fillCallback - Callback to fill the form
 */
const handleAutoFill = async (platform, type, fillCallback) => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      // Call the platform-specific fill callback
      fillCallback(response.content);

      // Track analytics
      await chrome.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform,
        contentType: type,
        contentId: response.contentId,
        variationId: response.variationId,
      });
    } else {
      throw new Error(response.error || 'No content available');
    }
  } catch (error) {
    console.error('Auto-fill error:', error);
    throw error;
  }
};

/**
 * Initialize content script with form detection
 * @param {Function} checkFormsCallback - Callback to check for forms
 */
export const initContentScript = (checkFormsCallback) => {
  const observer = new MutationObserver(() => {
    checkFormsCallback();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial check
  checkFormsCallback();
};

/**
 * Wait for DOM to be ready and initialize
 * @param {Function} initCallback - Initialization callback
 */
export const waitForDOM = (initCallback) => {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCallback);
  } else {
    initCallback();
  }
};

/**
 * Setup message listener and auto-inject buttons for a platform
 * This is a simplified setup function for platforms that use selector-based detection
 * @param {Function} extractContextFn - Function to extract page context
 * @param {Array<string>} inputSelectors - Array of CSS selectors for input fields
 */
export const setupMessageListener = (extractContextFn, inputSelectors) => {
  const api = typeof browser !== 'undefined' ? browser : chrome;
  
  // Set up message listener for context extraction
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_CONTEXT') {
      try {
        const context = extractContextFn();
        sendResponse({ success: true, context });
      } catch (error) {
        console.error('Failed to extract context:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
  });

  // Auto-inject buttons into detected input fields
  const checkAndInjectButtons = () => {
    inputSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((element) => {
        if (!element.dataset.defpromoInjected) {
          // Determine if this is a post or comment based on context
          const isComment = selector.toLowerCase().includes('comment') ||
                           selector.toLowerCase().includes('reply');
          const type = isComment ? 'comment' : 'post';
          
          // Get platform name from context function
          const context = extractContextFn();
          const platform = context.platform || 'unknown';
          
          // Create fill callback for this specific element
          const fillCallback = (content) => {
            if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
              element.value = content;
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
            } else if (element.contentEditable === 'true') {
              element.textContent = content;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            }
          };
          
          injectAutoFillButton(element, platform, type, fillCallback);
        }
      });
    });
  };

  // Initialize with MutationObserver
  initContentScript(checkAndInjectButtons);
  
  // Also run on DOM ready
  waitForDOM(checkAndInjectButtons);
};