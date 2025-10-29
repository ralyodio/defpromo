// Threads content script
console.log('DefPromo: Threads content script loaded');

/**
 * Extract Threads post context for AI generation
 */
const getThreadsPostContext = () => {
  try {
    let title = '';
    let content = '';
    
    console.log('Extracting Threads post context...');
    
    // Get post content - Threads uses similar structure to Instagram
    const postElement = document.querySelector('[role="article"]') ||
                       document.querySelector('article');
    
    console.log('Found post element:', !!postElement);
    
    if (postElement) {
      // Extract post text content - try multiple selectors
      const textSelectors = [
        'span[dir="auto"]',
        '[class*="Text"]',
        'div[class*="TextContent"]'
      ];
      
      for (const selector of textSelectors) {
        const textElements = postElement.querySelectorAll(selector);
        console.log(`Found ${textElements.length} text elements with selector: ${selector}`);
        
        if (textElements.length > 0) {
          for (const textElement of textElements) {
            const text = textElement.textContent?.trim();
            if (text && text.length > 10 && !text.includes('Reply')) {
              content = text;
              console.log('Found post content:', content.substring(0, 100));
              break;
            }
          }
          if (content) break;
        }
      }
      
      // Extract author name for context
      console.log('Looking for author...');
      const authorSelectors = [
        'a[role="link"]',
        '[class*="Username"]',
        'a[href*="/@"]'
      ];
      
      for (const selector of authorSelectors) {
        const authorElement = postElement.querySelector(selector);
        if (authorElement) {
          const authorName = authorElement.textContent?.trim() || '';
          if (authorName && authorName.length > 0 && authorName.length < 50) {
            title = `Threads post by ${authorName}`;
            console.log('Found author:', authorName);
            break;
          }
        }
      }
    }
    
    // Fallback: try to get any visible post text
    if (!content) {
      console.log('Using fallback content extraction');
      const textElements = document.querySelectorAll('span[dir="auto"]');
      for (const element of textElements) {
        const text = element.textContent?.trim();
        if (text && text.length > 50 && !text.includes('Reply')) {
          content = text;
          console.log('Found fallback content:', content.substring(0, 100));
          break;
        }
      }
    }
    
    // If still no title, use page title or URL
    if (!title) {
      title = document.title || window.location.href;
      console.log('Using fallback title:', title);
    }

    const result = {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
    
    console.log('Final extracted context:', result);
    return result;
  } catch (error) {
    console.error('Failed to extract Threads post context:', error);
    return { title: '', content: '' };
  }
};

/**
 * Detect Threads comment forms and inject auto-fill button
 */

const init = () => {
  console.log('Initializing Threads content script');
  
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
  // Threads comment input boxes (similar to Instagram)
  const commentBoxes = document.querySelectorAll('textarea[placeholder*="Reply"]') ||
                      document.querySelectorAll('textarea[aria-label*="Reply"]') ||
                      document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
  
  commentBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (editor, type) => {
  const container = editor.closest('form') || 
                   editor.closest('[role="article"]') ||
                   editor.parentElement;
  
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
    await handleAutoFill(editor, type);
  });

  buttonContainer.appendChild(button);
  
  // Try to insert after the editor
  if (editor.nextSibling) {
    editor.parentNode.insertBefore(buttonContainer, editor.nextSibling);
  } else {
    container.appendChild(buttonContainer);
  }
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
      
      // Handle both textarea and contenteditable
      if (editor.isContentEditable) {
        editor.textContent = response.content;
      } else {
        editor.value = response.content;
      }
      
      const inputEvent = new Event('input', { bubbles: true });
      editor.dispatchEvent(inputEvent);

      api.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'threads',
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
  console.log('Threads content script received message:', message.type);
  if (message.type === 'GET_PAGE_CONTEXT') {
    const context = getThreadsPostContext();
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