/**
 * Nostr Clients Content Script
 * Handles content extraction and form filling for Nostr clients (snort.social, iris.to, etc.)
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Reply"]',
    'textarea[placeholder*="What\'s on your mind"]',
    'textarea[name="content"]',
    'div[contenteditable="true"]',
  ],
  title: ['.note-author', '.username', '.display-name'],
  content: ['.note-content', '.note-text', '.content'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'nostr', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Nostr client content script loaded');