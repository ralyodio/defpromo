// Primal.net content script
import { injectAutoFillButton, initContentScript, waitForDOM } from './shared.js';

console.log('DefPromo: Primal.net content script loaded');

const PLATFORM = 'primal';

const init = () => {
  console.log('Initializing Primal.net content script');
  initContentScript(checkForForms);
};

const checkForForms = () => {
  // Primal uses textarea for Nostr posts
  const postBoxes = document.querySelectorAll('textarea[placeholder*="What\'s on your mind"]');
  const replyBoxes = document.querySelectorAll('textarea[placeholder*="Reply"]');
  
  postBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'post', (content) => {
        box.value = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });

  replyBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'comment', (content) => {
        box.value = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });
};

waitForDOM(init);