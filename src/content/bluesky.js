// Bluesky content script
(function() {
  'use strict';
  
  console.log('DefPromo: Bluesky content script loaded');

  // Register message listener IMMEDIATELY (before DOM ready)
  const api = typeof browser !== 'undefined' ? browser : chrome;
  api.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Bluesky content script received message:', message.type);
    if (message.type === 'GET_PAGE_CONTEXT') {
      const context = getBlueskyPostContext();
      console.log('Responding with context:', context);
      sendResponse({ success: true, context });
      return true;
    }
  });

  /**
   * Extract Bluesky post context for AI generation
   */
  const getBlueskyPostContext = () => {
    try {
      let title = '';
      let content = '';
      
      // Try to get post content from feed
      const postElements = document.querySelectorAll('[data-testid="postText"]');
      if (postElements.length > 0) {
        const firstPost = postElements[0];
        content = firstPost.textContent?.trim() || '';
        
        // Get author name as title
        const authorElement = firstPost.closest('[data-testid="feedItem"]')?.querySelector('[data-testid="authorName"]');
        if (authorElement) {
          title = authorElement.textContent?.trim() || '';
        }
      }
      
      // Fallback: Try alternative selectors
      if (!content) {
        // Look for contenteditable divs with content
        const contentDivs = document.querySelectorAll('[contenteditable="false"]');
        for (const div of contentDivs) {
          const text = div.textContent?.trim();
          if (text && text.length > 50) {
            content = text;
            break;
          }
        }
      }
      
      // If still no title, use page title
      if (!title) {
        title = document.title || window.location.href;
      }

      console.log('Extracted Bluesky context:', { title, content: content.substring(0, 100) + '...' });

      return {
        title: title.trim(),
        content: content.trim().substring(0, 1000) // Limit to 1000 chars
      };
    } catch (error) {
      console.error('Failed to extract Bluesky post context:', error);
      return { title: '', content: '' };
    }
  };

  /**
   * Detect Bluesky post/comment forms and inject auto-fill button
   */
  const init = () => {
    console.log('Initializing Bluesky content script');
    
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
    // Bluesky uses contenteditable divs
    const postBoxes = document.querySelectorAll('[contenteditable="true"][data-testid="composerTextInput"]');
    const replyBoxes = document.querySelectorAll('[contenteditable="true"][placeholder*="Write your reply"]');
    
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

  const injectButton = (editor, type) => {
    const container = editor.closest('form') || editor.parentElement;
    
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
    editor.parentNode.insertBefore(buttonContainer, editor.nextSibling);
  };

  const handleAutoFill = async (editor, type) => {
    try {
      const localApi = typeof browser !== 'undefined' ? browser : chrome;
      
      const response = await localApi.runtime.sendMessage({
        type: 'GET_CONTENT',
        contentType: type,
      });

      if (response.success && response.content) {
        editor.focus();
        editor.textContent = response.content;
        
        const inputEvent = new Event('input', { bubbles: true });
        editor.dispatchEvent(inputEvent);

        localApi.runtime.sendMessage({
          type: 'TRACK_USAGE',
          platform: 'bluesky',
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
