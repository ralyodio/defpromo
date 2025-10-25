// Twitter/X content script
console.log('DefPromo: Twitter content script loaded');

/**
 * Detect Twitter post/comment forms and inject auto-fill button
 */

// Wait for DOM to be ready
const init = () => {
  console.log('Initializing Twitter content script');
  
  // Observe DOM for new forms
  const observer = new MutationObserver((mutations) => {
    checkForForms();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Initial check
  checkForForms();
};

const checkForForms = () => {
  // Twitter's compose tweet textarea
  const tweetBoxes = document.querySelectorAll('[data-testid="tweetTextarea_0"]');
  const replyBoxes = document.querySelectorAll('[data-testid="tweetTextarea_0"][aria-label*="reply"]');
  
  tweetBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'post');
      box.dataset.defpromoInjected = 'true';
    }
  });

  replyBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (textarea, type) => {
  // Find the toolbar container
  const toolbar = textarea.closest('[role="textbox"]')?.parentElement?.querySelector('[role="group"]');
  
  if (!toolbar) return;

  // Create button
  const button = document.createElement('button');
  button.className = 'defpromo-btn';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
    </svg>
  `;
  button.title = 'Fill with DefPromo content';
  button.style.cssText = `
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 9999px;
    padding: 8px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleAutoFill(textarea, type);
  });

  // Insert button into toolbar
  toolbar.appendChild(button);
};

const handleAutoFill = async (textarea, type) => {
  try {
    // Request content from background script
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      // Fill the textarea
      textarea.focus();
      textarea.textContent = response.content;
      
      // Trigger input event to update React state
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Track analytics
      chrome.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'twitter',
        contentType: type,
        contentId: response.contentId,
        variationId: response.variationId,
      });
    }
  } catch (error) {
    console.error('Auto-fill error:', error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}