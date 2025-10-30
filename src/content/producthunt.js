/**
 * Product Hunt Content Script
 * Handles content extraction and form filling for Product Hunt
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[name="comment"]',
    'div[contenteditable="true"]',
  ],
  title: ['h1', '[data-test="product-name"]'],
  content: ['.product-description', '[data-test="product-description"]'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'producthunt', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Product Hunt content script loaded');