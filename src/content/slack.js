// Slack web interface content script
import { injectAutoFillButton, initContentScript, waitForDOM } from './shared.js';

console.log('DefPromo: Slack content script loaded');

const PLATFORM = 'slack';

const init = () => {
  console.log('Initializing Slack content script');
  initContentScript(checkForForms);
};

const checkForForms = () => {
  // Slack message composer
  const messageBoxes = document.querySelectorAll('[data-qa="message_input"]');
  const threadBoxes = document.querySelectorAll('[data-qa="message_input"][aria-label*="reply"]');
  
  messageBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'post', (content) => {
        box.textContent = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });

  threadBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'comment', (content) => {
        box.textContent = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });
};

waitForDOM(init);
