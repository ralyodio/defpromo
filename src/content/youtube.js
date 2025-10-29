// YouTube content script
console.log('DefPromo: YouTube content script loaded');

/**
 * Extract YouTube video context for AI generation
 */
const getYouTubeVideoContext = () => {
  try {
    let title = '';
    let content = '';
    
    console.log('Extracting YouTube video context...');
    
    // Get video title - YouTube has multiple layouts
    const titleSelectors = [
      'h1.ytd-video-primary-info-renderer',
      'yt-formatted-string.ytd-watch-metadata',
      '#title h1',
      'h1.style-scope.ytd-watch-metadata',
      'ytd-watch-metadata h1'
    ];
    
    for (const selector of titleSelectors) {
      const titleElement = document.querySelector(selector);
      if (titleElement) {
        const text = titleElement.textContent?.trim();
        if (text && text.length > 0) {
          title = text;
          console.log('Found video title:', title.substring(0, 100));
          break;
        }
      }
    }
    
    // Get video description
    console.log('Looking for video description...');
    const descriptionSelectors = [
      '#description-inline-expander',
      'yt-formatted-string.ytd-text-inline-expander',
      '#description',
      'ytd-text-inline-expander',
      '#structured-description'
    ];
    
    for (const selector of descriptionSelectors) {
      const descriptionElement = document.querySelector(selector);
      if (descriptionElement) {
        const text = descriptionElement.textContent?.trim();
        if (text && text.length > 10) {
          content = text;
          console.log('Found video description:', content.substring(0, 100));
          break;
        }
      }
    }
    
    // Get channel name for additional context
    if (!title) {
      console.log('Looking for channel name...');
      const channelSelectors = [
        '#channel-name a',
        'ytd-channel-name a',
        'yt-formatted-string.ytd-channel-name'
      ];
      
      for (const selector of channelSelectors) {
        const channelElement = document.querySelector(selector);
        if (channelElement) {
          const channelName = channelElement.textContent?.trim() || '';
          if (channelName) {
            title = `Video by ${channelName}`;
            console.log('Found channel name:', channelName);
            break;
          }
        }
      }
    }
    
    // Fallback: use page title
    if (!title) {
      title = document.title.replace(' - YouTube', '').replace('- YouTube', '') || window.location.href;
      console.log('Using fallback title:', title);
    }

    const result = {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
    
    console.log('Final extracted context:', result);
    return result;
  } catch (error) {
    console.error('Failed to extract YouTube video context:', error);
    return { title: '', content: '' };
  }
};

/**
 * Detect YouTube comment forms and inject auto-fill button
 */

const init = () => {
  console.log('Initializing YouTube content script');
  
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
  // YouTube comment input boxes
  const commentBoxes = document.querySelectorAll('#contenteditable-root[contenteditable="true"]') ||
                      document.querySelectorAll('div[id="contenteditable-root"]');
  
  commentBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defpromoInjected = 'true';
    }
  });
};

const injectButton = (editor, type) => {
  const container = editor.closest('#simple-box') || 
                   editor.closest('ytd-comment-simplebox-renderer') ||
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
      
      // YouTube uses contenteditable divs
      editor.textContent = response.content;
      
      const inputEvent = new Event('input', { bubbles: true });
      editor.dispatchEvent(inputEvent);

      api.runtime.sendMessage({
        type: 'TRACK_USAGE',
        platform: 'youtube',
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
  console.log('YouTube content script received message:', message.type);
  if (message.type === 'GET_PAGE_CONTEXT') {
    const context = getYouTubeVideoContext();
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