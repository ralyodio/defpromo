// YouTube content script
console.log('DefPromo: YouTube content script loaded');

/**
 * Extract YouTube video context for AI generation
 */
const getYouTubeVideoContext = () => {
  try {
    let title = '';
    let content = '';
    
    // Get video title
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer') ||
                        document.querySelector('yt-formatted-string.ytd-watch-metadata') ||
                        document.querySelector('#title h1');
    if (titleElement) {
      title = titleElement.textContent?.trim() || '';
    }
    
    // Get video description
    const descriptionElement = document.querySelector('#description-inline-expander') ||
                              document.querySelector('yt-formatted-string.ytd-text-inline-expander') ||
                              document.querySelector('#description');
    if (descriptionElement) {
      content = descriptionElement.textContent?.trim() || '';
    }
    
    // Get channel name for additional context
    const channelElement = document.querySelector('#channel-name a') ||
                          document.querySelector('ytd-channel-name a');
    if (channelElement && !title) {
      const channelName = channelElement.textContent?.trim() || '';
      title = `Video by ${channelName}`;
    }
    
    // Fallback: use page title
    if (!title) {
      title = document.title.replace(' - YouTube', '') || window.location.href;
    }

    console.log('Extracted YouTube context:', {
      title: title.substring(0, 50) + '...',
      content: content.substring(0, 100) + '...'
    });

    return {
      title: title.trim(),
      content: content.trim().substring(0, 1000) // Limit to 1000 chars
    };
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