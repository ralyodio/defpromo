// Facebook content script
console.log('DefNotPromo: Facebook content script loaded');

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
    if (!box.dataset.defnotpromoInjected) {
      injectButton(box, 'post');
      box.dataset.defnotpromoInjected = 'true';
    }
  });

  commentBoxes.forEach((box) => {
    if (!box.dataset.defnotpromoInjected) {
      injectButton(box, 'comment');
      box.dataset.defnotpromoInjected = 'true';
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
  button.className = 'defnotpromo-btn';
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="display: inline-block; margin-right: 4px;">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/>
    </svg>
    Fill with DefNotPromo
  `;
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
    const response = await chrome.runtime.sendMessage({
      type: 'GET_CONTENT',
      contentType: type,
    });

    if (response.success && response.content) {
      editor.focus();
      editor.innerHTML = `<p>${response.content}</p>`;
      
      const inputEvent = new Event('input', { bubbles: true });
      editor.dispatchEvent(inputEvent);

      chrome.runtime.sendMessage({
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}