// Reddit content script
console.log('DefPromo: Reddit content script loaded');

/**
 * Extract Reddit post context for AI generation
 */
const getRedditPostContext = () => {
  try {
    let title = '';
    let content = '';
    
    // Strategy: Find the main post container first, then extract from within it
    // This ensures we get the current post, not comments or other posts
    
    // Find the main post container - look for shreddit-post with visible attribute
    const mainPost = document.querySelector('shreddit-post[tabindex="-1"]') ||
                     document.querySelector('shreddit-post:not([id*="comment"])') ||
                     document.querySelector('main shreddit-post');
    
    if (mainPost) {
      console.log('Found main post container:', mainPost.id);
      
      // Get title from within the main post
      const titleElement = mainPost.querySelector('h1[id^="post-title-"]') ||
                          mainPost.querySelector('h1') ||
                          document.querySelector('h1[id^="post-title-"]');
      if (titleElement) {
        title = titleElement.textContent?.trim() || '';
      }
      
      // Get content from within the main post - try multiple selectors
      let contentElement = mainPost.querySelector('div[slot="text-body"]') ||
                          mainPost.querySelector('[id$="-post-rtjson-content"]') ||
                          mainPost.querySelector('.text-neutral-content') ||
                          mainPost.querySelector('[data-click-id="text"]');
      
      if (contentElement) {
        content = contentElement.textContent?.trim() || '';
        console.log('Found content element:', {
          tag: contentElement.tagName,
          class: contentElement.className,
          id: contentElement.id,
          contentLength: content.length
        });
      }
    } else {
      console.warn('Could not find main post container, trying fallback selectors');
      
      // Fallback: Try to get title and content without post container
      const titleElement = document.querySelector('h1[id^="post-title-"]');
      if (titleElement) {
        title = titleElement.textContent?.trim() || '';
      }
      
      // Try to find content in main content area
      const contentElement = document.querySelector('main [slot="text-body"]') ||
                            document.querySelector('main [id$="-post-rtjson-content"]') ||
                            document.querySelector('main .text-neutral-content');
      
      if (contentElement) {
        content = contentElement.textContent?.trim() || '';
      }
    }

    console.log('Extracted Reddit context:', {
      title: title.substring(0, 100),
      content: content.substring(0, 100),
      titleLength: title.length,
      contentLength: content.length,
      url: window.location.href
    });

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
  
  // Reddit markdown editor
  const markdownBoxes = document.querySelectorAll('textarea[slot="text-input"], textarea[name="markdown"]');
  
  postBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'post');
      box.dataset.defpromoInjected = 'true';
    }
  });

  [...commentBoxes, ...replyBoxes, ...markdownBoxes].forEach((box) => {
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
    const api = typeof browser !== 'undefined' ? browser : chrome;
    
    const response = await api.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      textarea.value = response.content;
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Track analytics
      api.runtime.sendMessage({
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

// Listen for messages from sidebar (Firefox compatible)
const api = typeof browser !== 'undefined' ? browser : chrome;
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Reddit content script received message:', message);
  
  if (message.type === 'GET_PAGE_CONTEXT') {
    console.log('Processing GET_PAGE_CONTEXT request');
    const context = getRedditPostContext();
    console.log('Sending context response:', context);
    sendResponse({ success: true, context });
    return true; // Keep channel open for async response
  }
  
  return false; // Close channel for other messages
});

console.log('Reddit content script message listener registered');

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}