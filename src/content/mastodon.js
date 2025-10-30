/**
 * Mastodon Content Script
 * Handles content extraction and form filling for Mastodon instances
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="What is on your mind"]',
    'textarea.autosuggest-textarea__textarea',
    'div[contenteditable="true"]',
  ],
  title: ['.status__content__text', '.display-name__html'],
  content: ['.status__content', '.e-content'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'mastodon', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Mastodon content script loaded');