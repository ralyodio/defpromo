// Primal.net (Nostr) content script
(function() {
  'use strict';
  
  console.log('DefPromo: Primal.net content script loaded');

  // Register message listener IMMEDIATELY (before DOM ready)
  const api = typeof browser !== 'undefined' ? browser : chrome;
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Primal content script received message:', message.type);
    if (message.type === 'GET_PAGE_CONTEXT') {
      const context = getPrimalPostContext();
      console.log('Responding with context:', context);
      sendResponse({ success: true, context });
      return true;
    }
  });

  /**
   * Extract Primal/Nostr post context for AI generation
   */
  const getPrimalPostContext = () => {
    try {
      let title = '';
      let content = '';
      
      console.log('Extracting Primal/Nostr post context...');
      
      // Try to get post content from feed - Primal uses specific class names
      const postSelectors = [
        '._parsedNote_2lzd7_1',  // Main post content class
        '[id^="note_"]',          // Posts have id starting with "note_"
        '._message_ar7o5_64',     // Message container class
        'div[class*="parsedNote"]',
        'div[class*="noteContent"]'
      ];
      
      for (const selector of postSelectors) {
        const postElements = document.querySelectorAll(selector);
        console.log(`Found ${postElements.length} elements with selector: ${selector}`);
        
        if (postElements.length > 0) {
          for (const post of postElements) {
            const text = post.textContent?.trim();
            // Primal uses multiple spaces between words, normalize them
            const cleanText = text?.replace(/\s+/g, ' ').trim();
            if (cleanText && cleanText.length > 10 && !cleanText.includes('Reply') && !cleanText.includes('What\'s on your mind')) {
              content = cleanText;
              console.log('Found post content:', content.substring(0, 100));
              
              // Get author name as title - look for username classes
              const parentNote = post.closest('[class*="note"]') || 
                                 post.closest('[data-event]') ||
                                 post.closest('._notePrimary_ar7o5_478');
              
              if (parentNote) {
                const authorSelectors = [
                  '._userName_ar7o5_364',    // Primary username class
                  '._userName_p3s0n_50',     // Alternative username class
                  '[class*="_userName"]',    // Any username class
                  '[class*="userName"]'      // Generic username class
                ];
                
                for (const authSelector of authorSelectors) {
                  const authorElement = parentNote.querySelector(authSelector);
                  if (authorElement) {
                    const authorText = authorElement.textContent?.trim();
                    if (authorText && authorText.length > 0 && authorText.length < 100) {
                      title = authorText;
                      console.log('Found author:', title);
                      break;
                    }
                  }
                }
              }
              break;
            }
          }
          if (content) break;
        }
      }
      
      // Fallback: Try to get from visible divs/spans
      if (!content) {
        console.log('Using fallback content extraction');
        const textElements = document.querySelectorAll('div[class*="text"], span[class*="text"]');
        for (const element of textElements) {
          const text = element.textContent?.trim();
          if (text && text.length > 50 && !text.includes('What\'s on your mind')) {
            content = text;
            console.log('Found fallback content:', content.substring(0, 100));
            break;
          }
        }
      }
      
      // If still no title, use page title
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
      console.error('Failed to extract Primal post context:', error);
      return { title: '', content: '' };
    }
  };

  /**
   * Detect Primal post/comment forms and inject auto-fill button
   */
  const init = () => {
    console.log('Initializing Primal.net content script');
    
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
    // Primal uses textarea for Nostr posts
    const postBoxes = document.querySelectorAll('textarea[placeholder*="What\'s on your mind"]');
    const replyBoxes = document.querySelectorAll('textarea[placeholder*="Reply"]');
    
    postBoxes.forEach((box) => {
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
    const container = textarea.closest('form') || textarea.parentElement;
    
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
    textarea.parentNode.insertBefore(buttonContainer, textarea.nextSibling);
  };

  const handleAutoFill = async (textarea, type) => {
    try {
      const localApi = typeof browser !== 'undefined' ? browser : chrome;
      
      const response = await localApi.runtime.sendMessage({
        type: 'GET_CONTENT',
        contentType: type,
      });

      if (response.success && response.content) {
        textarea.focus();
        textarea.value = response.content;
        
        const inputEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);

        localApi.runtime.sendMessage({
          type: 'TRACK_USAGE',
          platform: 'primal',
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
})();
