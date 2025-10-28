// Instagram content script
console.log('DefPromo: Instagram content script loaded');

/**
 * Extract Instagram post context for AI generation
 */
const getInstagramPostContext = () => {
  try {
    let title = '';
    let content = '';
    
    // Get post caption
    const captionElement = document.querySelector('h1._ap3a._aaco._aacu._aacx._aad7._aade') ||
                          document.querySelector('span._ap3a._aaco._aacu._aacx._aad6._aade') ||
                          document.querySelector('[class*="Caption"]');
    if (captionElement) {
      content = captionElement.textContent?.trim() || '';
    }
    
    // Get author username for context
    const authorElement = document.querySelector('a[class*="notranslate"]') ||
                         document.querySelector('header a[role="link"]');
    if (authorElement) {
      const authorName = authorElement.textContent?.trim() || '';
      title = `Instagram post by ${authorName}`;
    }
    
    // Fallback: try alternative selectors
    if (!content) {
      const altCaption = document.querySelector('article span[dir="auto"]');
      if (altCaption) {
        content = altCaption.textContent?.trim() || '';
      }
    }
    
    // If still no title, use page title or URL
    if (!title) {
      title = document.title || window.location.href;
    }

    console.log('Extracted Instagram context:', {
      title: title.substring(0, 50) + '...',
      content: content.substring(0, 100) + '...'
    });

    return {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
  } catch (error) {
    console.error('Failed to extract Instagram post context:', error);
    return { title: '', content: '' };
  }
};

/**
 * Detect Instagram comment forms and inject auto-fill button
 */

const init = () => {
  console.log('Initializing Instagram content script');
  
  const observer = new MutationObserver(() => {
    checkForForms();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  checkForForms();
};

const checkForForms = () => {
  // Instagram comment input boxes
  const commentBoxes = document.querySelectorAll('textarea[placeholder*="Add a comment"]') ||
                      document.querySelectorAll('textarea[aria-label*="Add a comment"]');
  
  commentBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (textarea, type) => {
  const container = textarea.closest('form') || 
                   textarea.closest('section') ||
                   textarea.parentElement;
  
  if (!container) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin: 8px 0;';

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
    padding: 8px 16px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleAutoFill(textarea, type);
  });

  buttonContainer.appendChild(button);
  
  // Try to insert after the textarea
  if (textarea.nextSibling) {
    textarea.parentNode.insertBefore(buttonContainer, textarea.nextSibling);
  } else {
    container.appendChild(buttonContainer);
  }
};

const handleAutoFill = async (textarea, type) => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      textarea.focus();
      textarea.value = response.content;
      
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      chrome.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'instagram',
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
    const context = getInstagramPostContext();
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