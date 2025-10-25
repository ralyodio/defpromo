/**
 * Shared utilities for content scripts
 * Common functionality used across all platform content scripts
 */

/**
 * Create and inject the DefNotPromo auto-fill button
 * @param {HTMLElement} targetElement - The form element to attach the button to
 * @param {string} platform - Platform name (e.g., 'twitter', 'reddit')
 * @param {string} type - Content type ('post' or 'comment')
 * @param {Function} fillCallback - Callback function to fill the form with content
 */
export const injectAutoFillButton = (targetElement, platform, type, fillCallback) => {
  if (targetElement.dataset.defnotpromoInjected) {
    return; // Already injected
  }

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'defnotpromo-button-container';
  buttonContainer.style.cssText = 'margin: 8px 0;';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'defnotpromo-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px; vertical-align: middle;">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
    </svg>
    <span>Fill with DefNotPromo</span>
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
          <span>Fill with DefNotPromo</span>
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
          <span>Fill with DefNotPromo</span>
        `;
        button.style.background = '#0ea5e9';
        button.disabled = false;
      }, 2000);
    }
  });

  buttonContainer.appendChild(button);
  targetElement.parentNode.insertBefore(buttonContainer, targetElement.nextSibling);
  targetElement.dataset.defnotpromoInjected = 'true';
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