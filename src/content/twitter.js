// Twitter/X content script
(function() {
  'use strict';
  
console.log('DefPromo: Twitter content script loaded');

/**
 * Extract Twitter/X post context for AI generation
 */
const getTwitterPostContext = () => {
  try {
    let title = '';
    let content = '';
    
    // Try to get the main tweet content (the tweet being replied to)
    // Look for article with role="article" and tabindex="-1" (main tweet)
    const tweetArticles = document.querySelectorAll('article[data-testid="tweet"]');
    
    if (tweetArticles.length > 0) {
      // First tweet is usually the one being replied to
      const mainTweet = tweetArticles[0];
      
      // Get author name
      const authorElement = mainTweet.querySelector('[data-testid="User-Name"]');
      if (authorElement) {
        title = authorElement.textContent?.trim() || '';
      }
      
      // Get tweet text
      const tweetTextElement = mainTweet.querySelector('[data-testid="tweetText"]');
      if (tweetTextElement) {
        content = tweetTextElement.textContent?.trim() || '';
      }
      
      // If no content, try lang attribute div
      if (!content) {
        const langDiv = mainTweet.querySelector('div[lang]');
        if (langDiv) {
          content = langDiv.textContent?.trim() || '';
        }
      }
    }
    
    // Fallback: Get any visible tweet text
    if (!content) {
      const tweetText = document.querySelector('[data-testid="tweetText"]');
      if (tweetText) {
        content = tweetText.textContent?.trim() || '';
      }
    }
    
    // Additional fallback: check for quote tweets or embedded content
    if (!content) {
      const quoteTweet = document.querySelector('[data-testid="quoteTweet"]');
      if (quoteTweet) {
        const quoteText = quoteTweet.querySelector('[data-testid="tweetText"]');
        if (quoteText) {
          content = quoteText.textContent?.trim() || '';
        }
      }
    }
    
    // If still no title, use page title or URL
    if (!title) {
      title = document.title || window.location.href;
    }

    console.log('Extracted context:', { title, content: content.substring(0, 100) + '...' });

    return {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
  } catch (error) {
    console.error('Failed to extract Twitter post context:', error);
    return { title: '', content: '' };
  }
};

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
    const api = typeof browser !== 'undefined' ? browser : chrome;
    
    // Request content from background script
    const response = await api.runtime.sendMessage({
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
      api.runtime.sendMessage({
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

// Listen for messages from sidebar (Firefox compatible)
const api = typeof browser !== 'undefined' ? browser : chrome;
api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Twitter content script received message:', message.type);
  if (message.type === 'GET_PAGE_CONTEXT') {
    const context = getTwitterPostContext();
    console.log('Responding with context:', context);
    sendResponse({ success: true, context });
    return true;
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
