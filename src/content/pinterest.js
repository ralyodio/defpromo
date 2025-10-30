/**
 * Pinterest Content Script
 * Handles content extraction and form filling for Pinterest
 */

import { setupMessageListener } from './shared.js';

// Pinterest-specific selectors
const SELECTORS = {
  // Comment/description input
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[aria-label*="Add a comment"]',
    'div[contenteditable="true"][role="textbox"]',
  ],
  
  // Post title
  title: [
    'h1',
    '[data-test-id="pin-title"]',
  ],
  
  // Post content
  content: [
    '[data-test-id="pin-description"]',
    '.pinDescription',
  ],
};

/**
 * Extract page context from Pinterest
 */
function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';

  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';

  return {
    title,
    content,
    platform: 'pinterest',
    url: window.location.href,
  };
}

// Set up message listener
setupMessageListener(extractContext, SELECTORS.commentInput);

console.log('Pinterest content script loaded');