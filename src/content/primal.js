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
    // Primal uses textarea for Nostr posts - multiple selectors for different contexts
    const textareas = document.querySelectorAll(`
      textarea[placeholder*="What's on your mind"],
      textarea[placeholder*="Reply"],
      textarea[id*="new_note_text_area"],
      textarea[id*="reply"],
      ._newNote_sbubx_1 textarea,
      ._noteEditBox_1pmle_1 textarea
    `.trim().split(',').map(s => s.trim()).join(','));
    
    console.log('Primal: Found', textareas.length, 'textareas');
    
    textareas.forEach((box) => {
      if (!box.dataset.defpromoInjected) {
        // Determine type based on ID or context
        const isReply = box.id?.includes('reply') || box.closest('[id*="reply"]');
        const type = isReply ? 'comment' : 'post';
        console.log('Primal: Injecting button for', type, 'textarea:', box.id);
        injectButton(box, type);
        box.dataset.defpromoInjected = 'true';
      }
    });
  };

  const injectButton = (textarea, type) => {
    // Try to find the editor controls container first
    const editorControls = textarea.closest('._noteEditBox_1pmle_1')?.querySelector('._editorDescision_1pmle_117');
    const container = editorControls || textarea.closest('form') || textarea.parentElement;
    
    if (!container) {
      console.log('Primal: No container found for button injection');
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'defpromo-btn _secondary_1meo7_19'; // Use Primal's secondary button style
    button.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px;">
        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
      </svg>
      DefPromo
    `;
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-right: 8px;
    `;

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Primal: DefPromo button clicked');
      await handleAutoFill(textarea, type);
    });

    // If we found the editor controls, insert at the beginning
    if (editorControls) {
      editorControls.insertBefore(button, editorControls.firstChild);
      console.log('Primal: Button injected into editor controls');
    } else {
      // Fallback: insert after textarea
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'margin: 8px 0;';
      buttonContainer.appendChild(button);
      textarea.parentNode.insertBefore(buttonContainer, textarea.nextSibling);
      console.log('Primal: Button injected as fallback');
    }
  };

  const handleAutoFill = async (textarea, type) => {
    try {
      const localApi = typeof browser !== 'undefined' ? browser : chrome;
      
      console.log('Primal: Requesting content for', type);
      
      const response = await localApi.runtime.sendMessage({
        type: 'GET_CONTENT',
        contentType: type,
      });

      if (response.success && response.content) {
        console.log('Primal: Received content, filling textarea');
        
        // Focus the textarea
        textarea.focus();
        
        // Set the value
        textarea.value = response.content;
        
        // Trigger input events to update Primal's internal state
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        textarea.dispatchEvent(inputEvent);
        
        const changeEvent = new Event('change', { bubbles: true });
        textarea.dispatchEvent(changeEvent);
        
        // Try to enable the Post button
        const postButton = textarea.closest('._noteEditBox_1pmle_1')?.querySelector('._primary_1meo7_1');
        if (postButton) {
          postButton.removeAttribute('disabled');
          postButton.removeAttribute('data-disabled');
          console.log('Primal: Post button enabled');
        }
        
        console.log('Primal: Textarea filled successfully');

        localApi.runtime.sendMessage({
          type: 'TRACK_USAGE',
          platform: 'primal',
          contentType: type,
          contentId: response.contentId,
          variationId: response.variationId,
        });
      } else {
        console.error('Primal: Failed to get content', response);
      }
    } catch (error) {
      console.error('Primal: Auto-fill error:', error);
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
