// Facebook content script
console.log('DefPromo: Facebook content script loaded');

/**
 * Extract Facebook post context for AI generation
 */
const getFacebookPostContext = () => {
  try {
    let title = '';
    let content = '';
    
    // Try to get post content from feed
    const postElements = document.querySelectorAll('[data-ad-preview="message"]');
    if (postElements.length > 0) {
      const firstPost = postElements[0];
      content = firstPost.textContent?.trim() || '';
    }
    
    // Alternative: Look for post text in various containers
    if (!content) {
      const altPost = document.querySelector('[data-ad-comet-preview="message"]') ||
                     document.querySelector('[dir="auto"][style*="text-align"]');
      if (altPost) {
        content = altPost.textContent?.trim() || '';
      }
    }
    
    // Get author name for title
    const authorElement = document.querySelector('strong a[role="link"]') ||
                         document.querySelector('h2 a') ||
                         document.querySelector('h3 a');
    if (authorElement) {
      title = authorElement.textContent?.trim() || '';
    }
    
    // If still no title, use page title
    if (!title) {
      title = document.title || window.location.href;
    }

    console.log('Extracted Facebook context:', { title, content: content.substring(0, 100) + '...' });

    return {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
  } catch (error) {
    console.error('Failed to extract Facebook post context:', error);
    return { title: '', content: '' };
  }
};

/**
 * Detect Facebook post/comment forms and inject auto-fill button
 */

const init = () => {
  console.log('Initializing Facebook content script');
  
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
  // Facebook post composer
  const postBoxes = document.querySelectorAll('[contenteditable="true"][role="textbox"][aria-label*="What\'s on your mind"]');
  const commentBoxes = document.querySelectorAll('[contenteditable="true"][role="textbox"][aria-label*="Write a comment"]');
  
  postBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'post');
      box.dataset.defpromoInjected = 'true';
    }
  });

  commentBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (editor, type) => {
  const container = editor.closest('[role="dialog"]') || editor.parentElement;
  
  if (!container) return;

  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = 'margin: 8px 0;';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'defpromo-btn';
  
  // Create SVG element safely
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'currentColor');
  svg.style.cssText = 'display: inline-block; margin-right: 4px;';
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z');
  svg.appendChild(path);
  
  button.appendChild(svg);
  button.appendChild(document.createTextNode(' Fill with DefPromo'));
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
  `;

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await handleAutoFill(editor, type);
  });

  buttonContainer.appendChild(button);
  editor.parentNode.insertBefore(buttonContainer, editor.nextSibling);
};

const handleAutoFill = async (editor, type) => {
  try {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    
    const response = await api.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      editor.focus();
      
      // Safely set content using textContent to avoid XSS
      const p = document.createElement('p');
      p.textContent = response.content;
      editor.innerHTML = ''; // Clear existing content
      editor.appendChild(p);
      
      const inputEvent = new Event('input', { bubbles: true });
      editor.dispatchEvent(inputEvent);

      api.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'facebook',
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
  console.log('Facebook content script received message:', message.type);
  if (message.type === 'GET_PAGE_CONTEXT') {
    const context = getFacebookPostContext();
    console.log('Responding with context:', context);
    sendResponse({ success: true, context });
    return true;
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}