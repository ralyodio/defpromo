// TikTok content script
console.log('DefPromo: TikTok content script loaded');

/**
 * Extract TikTok video context for AI generation
 */
const getTikTokVideoContext = () => {
  try {
    let title = '';
    let content = '';
    
    console.log('Extracting TikTok video context...');
    
    // Get video description/caption - TikTok uses data-e2e attributes
    const captionSelectors = [
      '[data-e2e="browse-video-desc"]',
      '[data-e2e="video-desc"]',
      '[data-e2e="search-video-desc"]',
      '.tiktok-j2a19r-SpanText',
      '[class*="DivContainer"]'
    ];
    
    for (const selector of captionSelectors) {
      const captionElements = document.querySelectorAll(selector);
      console.log(`Found ${captionElements.length} elements with selector: ${selector}`);
      
      if (captionElements.length > 0) {
        for (const caption of captionElements) {
          const text = caption.textContent?.trim();
          if (text && text.length > 10 && !text.includes('Add comment')) {
            content = text;
            console.log('Found caption:', content.substring(0, 100));
            break;
          }
        }
        if (content) break;
      }
    }
    
    // Get author username for context
    console.log('Looking for author username...');
    const authorSelectors = [
      '[data-e2e="browse-username"]',
      '[data-e2e="video-author-uniqueid"]',
      '[data-e2e="search-card-user-link"]'
    ];
    
    for (const selector of authorSelectors) {
      const authorElement = document.querySelector(selector);
      if (authorElement) {
        const authorName = authorElement.textContent?.trim() || '';
        if (authorName && authorName.length > 0 && authorName.length < 50) {
          title = `TikTok by ${authorName}`;
          console.log('Found author:', authorName);
          break;
        }
      }
    }
    
    // Fallback: Look for any substantial text
    if (!content) {
      console.log('Using fallback content extraction');
      const spans = document.querySelectorAll('span[class*="SpanText"]');
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text && text.length > 50 && !text.includes('Add comment')) {
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
    console.error('Failed to extract TikTok video context:', error);
    return { title: '', content: '' };
  }
};

/**
 * Detect TikTok comment forms and inject auto-fill button
 */

const init = () => {
  console.log('Initializing TikTok content script');
  
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
  // TikTok comment input boxes
  const commentBoxes = document.querySelectorAll('[data-e2e="comment-input"]') ||
                      document.querySelectorAll('div[contenteditable="true"][data-text="Add comment..."]');
  
  commentBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (editor, type) => {
  const container = editor.closest('[class*="CommentContainer"]') || 
                   editor.closest('[class*="InputContainer"]') ||
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
      
      // TikTok uses contenteditable divs
      if (editor.isContentEditable) {
        editor.textContent = response.content;
      } else {
        editor.value = response.content;
      }
      
      const inputEvent = new Event('input', { bubbles: true });
      editor.dispatchEvent(inputEvent);

      api.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'tiktok',
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
  console.log('TikTok content script received message:', message.type);
  if (message.type === 'GET_PAGE_CONTEXT') {
    const context = getTikTokVideoContext();
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