/**
 * Warpcast Content Script
 * Handles content extraction and form filling for Warpcast (Farcaster)
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Cast your reply"]',
    'textarea[placeholder*="What\'s happening"]',
    'div[contenteditable="true"]',
  ],
  title: ['.cast-author', '.username'],
  content: ['.cast-text', '.cast-content'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'warpcast', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Warpcast content script loaded');