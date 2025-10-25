// Bluesky content script
import { injectAutoFillButton, initContentScript, waitForDOM } from './shared.js';

console.log('DefPromo: Bluesky content script loaded');

const PLATFORM = 'bluesky';

const init = () => {
  console.log('Initializing Bluesky content script');
  initContentScript(checkForForms);
};

const checkForForms = () => {
  // Bluesky uses contenteditable divs
  const postBoxes = document.querySelectorAll('[contenteditable="true"][data-testid="composerTextInput"]');
  const replyBoxes = document.querySelectorAll('[contenteditable="true"][placeholder*="Write your reply"]');
  
  postBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'post', (content) => {
        box.textContent = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });

  replyBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'comment', (content) => {
        box.textContent = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });
};

waitForDOM(init);