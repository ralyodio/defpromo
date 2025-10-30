/**
 * Post.news Content Script
 * Handles content extraction and form filling for Post.news
 */

import { setupMessageListener } from './shared.js';

const SELECTORS = {
  commentInput: [
    'textarea[placeholder*="Add a comment"]',
    'textarea[name="comment"]',
    'div[contenteditable="true"]',
  ],
  title: ['h1', '.post-title'],
  content: ['.post-content', '.post-body'],
};

function extractContext() {
  const title = SELECTORS.title
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  const content = SELECTORS.content
    .map(sel => document.querySelector(sel))
    .find(el => el)?.textContent?.trim() || '';
  return { title, content, platform: 'postnews', url: window.location.href };
}

setupMessageListener(extractContext, SELECTORS.commentInput);
console.log('Post.news content script loaded');