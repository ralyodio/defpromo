// Reddit content script
console.log('DefPromo: Reddit content script loaded');

/**
 * Extract Reddit post context for AI generation
 */
const getRedditPostContext = () => {
  try {
    let title = '';
    let content = '';
    
    // Get title using wildcard selector for #post-title-*
    const titleElement = document.querySelector('[id^="post-title-"]');
    if (titleElement) {
      title = titleElement.textContent?.trim() || '';
    }
    
    // Get content from the specific DOM structure
    const textBodyContainer = document.querySelector('[data-post-click-location="text-body"]');
    if (textBodyContainer) {
      const contentDiv = textBodyContainer.querySelector('[property="schema:articleBody"]');
      if (contentDiv) {
        content = contentDiv.textContent?.trim() || '';
      }
    }
    
    // Fallback to generic selectors if specific ones fail
    if (!title) {
      title = document.querySelector('h1')?.textContent?.trim() || document.title;
    }
    
    if (!content) {
      // Try shreddit-post as fallback
      const shredditPost = document.querySelector('shreddit-post');
      if (shredditPost) {
        const textBody = shredditPost.querySelector('[slot="text-body"]');
        if (textBody) {
          content = textBody.textContent?.trim() || '';
        }
      }
    }

    console.log('Extracted context:', { title, content: content.substring(0, 100) + '...' });

    return {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
  } catch (error) {
    console.error('Failed to extract Reddit post context:', error);
    return { title: '', content: '' };
  }
};

/**
 * Detect Reddit post/comment forms and inject auto-fill button
 */

const init = () => {
  console.log('Initializing Reddit content script');
  
  // Observe DOM for new forms
  const observer = new MutationObserver(() => {
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
  // Reddit's new post textarea (new Reddit design)
  const postBoxes = document.querySelectorAll('[placeholder*="Title"]');
  const commentBoxes = document.querySelectorAll('[placeholder*="What are your thoughts?"]');
  const replyBoxes = document.querySelectorAll('textarea[name="comment"]');
  
  postBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'post');
      box.dataset.defpromoInjected = 'true';
    }
  });

  [...commentBoxes, ...replyBoxes].forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (textarea, type) => {
  // Find parent container
  const container = textarea.closest('form') || textarea.parentElement;
  
  if (!container) return;

  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin-top: 8px;';

  // Create button
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'defpromo-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px;">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
    </svg>
    Fill with DefPromo
  `;
  button.style.cssText = `
    background: #0ea5e9;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleAutoFill(textarea, type);
  });

  buttonContainer.appendChild(button);
  
  // Insert after textarea
  textarea.parentNode.insertBefore(buttonContainer, textarea.nextSibling);
};

const handleAutoFill = async (textarea, type) => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      textarea.value = response.content;
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Track analytics
      chrome.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'reddit',
        contentType: type,
        contentId: response.contentId,
        variationId: response.variationId,
      });
    }
  } catch (error) {
    console.error('Auto-fill error:', error);
  }
};

// Listen for messages from sidebar
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTEXT') {
    const context = getRedditPostContext();
    sendResponse({ success: true, context });
    return true;
  }
});

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}