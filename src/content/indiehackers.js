/**
 * Indie Hackers Content Script
 * Handles content extraction and form filling for Indie Hackers
 */

import { setupMessageListener } from './shared.js';

// Indie Hackers-specific selectors
const SELECTORS = {
  // Comment input
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[name="content"]',
    'div[contenteditable="true"]',
  ],
  
  // Post title
  title: [
    'h1',
    '.post-title',
    '[data-test="post-title"]',
  ],
  
  // Post content
  content: [
    '.post-content',
    '.post-body',
    '[data-test="post-content"]',
  ],
};

/**
 * Extract page context from Indie Hackers
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
    platform: 'indiehackers',
    url: window.location.href,
  };
}

// Set up message listener
setupMessageListener(extractContext, SELECTORS.commentInput);

console.log('Indie Hackers content script loaded');