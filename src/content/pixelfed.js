/**
 * Pixelfed Content Script
 * Handles content extraction and form filling for Pixelfed instances
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'input[placeholder*="Add a comment"]',
    'div[contenteditable="true"]',
  ],
  title: ['.username', '.profile-link'],
  content: ['.caption', '.status-text'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'pixelfed', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Pixelfed content script loaded');