/**
 * Hacker News Content Script
 * Handles content extraction and form filling for Hacker News
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[name="text"]',
    'textarea',
  ],
  title: ['.titleline > a', '.title > a'],
  content: ['.comment', '.toptext'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'hackernews', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Hacker News content script loaded');