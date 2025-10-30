/**
 * Replit Content Script
 * Handles content extraction and form filling for Replit
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[name="comment"]',
    'div[contenteditable="true"]',
  ],
  title: ['h1', '.repl-title'],
  content: ['.repl-description', '.markdown-body'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'replit', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Replit content script loaded');