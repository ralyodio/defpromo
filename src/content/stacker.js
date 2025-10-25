// Stacker News content script
import { injectAutoFillButton, initContentScript, waitForDOM } from './shared.js';

console.log('DefNotPromo: Stacker News content script loaded');

const PLATFORM = 'stacker';

const init = () => {
  console.log('Initializing Stacker News content script');
  initContentScript(checkForForms);
};

const checkForForms = () => {
  // Stacker News uses markdown textarea
  const postBoxes = document.querySelectorAll('textarea[placeholder*="Title"]');
  const commentBoxes = document.querySelectorAll('textarea[placeholder*="reply"]');
  
  postBoxes.forEach((box) => {
    if (!box.dataset.defnotpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'post', (content) => {
        box.value = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });

  commentBoxes.forEach((box) => {
    if (!box.dataset.defnotpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'comment', (content) => {
        box.value = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });
};

waitForDOM(init);