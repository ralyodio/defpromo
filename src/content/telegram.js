// Telegram web interface content script
import { injectAutoFillButton, initContentScript, waitForDOM } from './shared.js';

console.log('DefPromo: Telegram content script loaded');

const PLATFORM = 'telegram';

const init = () => {
  console.log('Initializing Telegram content script');
  initContentScript(checkForForms);
};

const checkForForms = () => {
  // Telegram message input
  const messageBoxes = document.querySelectorAll('[contenteditable="true"].input-message-input');
  
  messageBoxes.forEach((box) => {
    if (!box.dataset.defpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'post', (content) => {
        box.textContent = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });
};

waitForDOM(init);