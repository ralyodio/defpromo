// Discord web interface content script
import { injectAutoFillButton, initContentScript, waitForDOM } from './shared.js';

console.log('DefNotPromo: Discord content script loaded');

const PLATFORM = 'discord';

const init = () => {
  console.log('Initializing Discord content script');
  initContentScript(checkForForms);
};

const checkForForms = () => {
  // Discord message input
  const messageBoxes = document.querySelectorAll('[role="textbox"][data-slate-editor="true"]');
  
  messageBoxes.forEach((box) => {
    if (!box.dataset.defnotpromoInjected) {
      injectAutoFillButton(box, PLATFORM, 'post', (content) => {
        box.textContent = content;
        box.dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  });
};

waitForDOM(init);