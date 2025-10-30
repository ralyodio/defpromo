/**
 * Hashnode Content Script
 * Handles content extraction and form filling for Hashnode
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[name="comment"]',
    'div[contenteditable="true"]',
  ],
  title: ['h1', '.article-title'],
  content: ['.article-content', '.prose'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'hashnode', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Hashnode content script loaded');