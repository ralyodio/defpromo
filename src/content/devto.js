/**
 * DEV.to Content Script
 * Handles content extraction and form filling for DEV.to
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[name="comment"]',
    '.crayons-textfield',
  ],
  title: ['h1', '.crayons-article__header__meta h1'],
  content: ['.crayons-article__body', '#article-body'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'devto', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('DEV.to content script loaded');