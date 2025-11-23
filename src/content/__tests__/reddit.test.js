/**
 * Tests for Reddit content script context extraction
 * Using JSDOM to simulate browser DOM environment
 */

import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { JSDOM } from 'jsdom';

describe('Reddit Context Extraction', () => {
  let dom;
  let document;
  let window;
  let getRedditPostContext;

  beforeEach(() => {
    // Create a new JSDOM instance for each test
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://www.reddit.com/r/test/comments/abc123/test_post/',
    });
    document = dom.window.document;
    window = dom.window;

    // Make document and window global for the function
    global.document = document;
    global.window = window;
    global.console = {
      log: () => {},
      warn: () => {},
      error: () => {},
    };

    // Define the function to test (extracted from reddit.js)
    getRedditPostContext = () => {
      try {
        let title = '';
        let content = '';

        // Strategy: Find the main post container first
        const mainPost =
          document.querySelector('shreddit-post[tabindex="-1"]') ||
          document.querySelector('shreddit-post:not([id*="comment"])') ||
          document.querySelector('main shreddit-post');

        if (mainPost) {
          // Get title from within the main post
          const titleElement =
            mainPost.querySelector('h1[id^="post-title-"]') ||
            mainPost.querySelector('h1') ||
            document.querySelector('h1[id^="post-title-"]');
          if (titleElement) {
            title = titleElement.textContent?.trim() || '';
          }

          // Get content from within the main post
          let contentElement =
            mainPost.querySelector('div[slot="text-body"]') ||
            mainPost.querySelector('[id$="-post-rtjson-content"]') ||
            mainPost.querySelector('.text-neutral-content') ||
            mainPost.querySelector('[data-click-id="text"]');

          if (contentElement) {
            content = contentElement.textContent?.trim() || '';
          }
        } else {
          // Fallback
          const titleElement = document.querySelector('h1[id^="post-title-"]');
          if (titleElement) {
            title = titleElement.textContent?.trim() || '';
          }

          const contentElement =
            document.querySelector('main [slot="text-body"]') ||
            document.querySelector('main [id$="-post-rtjson-content"]') ||
            document.querySelector('main .text-neutral-content');

          if (contentElement) {
            content = contentElement.textContent?.trim() || '';
          }
        }

        return {
          title: title.trim(),
          content: content.trim().substring(0, 1000),
        };
      } catch (error) {
        return { title: '', content: '' };
      }
    };
  });

  afterEach(() => {
    // Clean up globals
    delete global.document;
    delete global.window;
    dom.window.close();
  });

  describe('Modern Reddit Layout (shreddit-post)', () => {
    it('should extract title and content from main post with tabindex', () => {
      // Setup DOM
      const mainPost = document.createElement('shreddit-post');
      mainPost.setAttribute('tabindex', '-1');
      mainPost.setAttribute('id', 't3_abc123');

      const title = document.createElement('h1');
      title.setAttribute('id', 'post-title-abc123');
      title.textContent = 'Test Post Title';

      const contentDiv = document.createElement('div');
      contentDiv.setAttribute('slot', 'text-body');
      contentDiv.textContent = 'This is the post content with some details.';

      mainPost.appendChild(title);
      mainPost.appendChild(contentDiv);
      document.body.appendChild(mainPost);

      // Execute
      const result = getRedditPostContext();

      // Assert
      expect(result.title).toBe('Test Post Title');
      expect(result.content).toBe('This is the post content with some details.');
    });

    it('should extract content using alternative selector (id ending with -post-rtjson-content)', () => {
      const mainPost = document.createElement('shreddit-post');
      mainPost.setAttribute('tabindex', '-1');

      const title = document.createElement('h1');
      title.setAttribute('id', 'post-title-xyz789');
      title.textContent = 'Another Test Post';

      const contentDiv = document.createElement('div');
      contentDiv.setAttribute('id', 't3_xyz789-post-rtjson-content');
      contentDiv.textContent = 'Content using rtjson format.';

      mainPost.appendChild(title);
      mainPost.appendChild(contentDiv);
      document.body.appendChild(mainPost);

      const result = getRedditPostContext();

      expect(result.title).toBe('Another Test Post');
      expect(result.content).toBe('Content using rtjson format.');
    });

    it('should extract content using class selector (.text-neutral-content)', () => {
      const mainPost = document.createElement('shreddit-post');
      mainPost.setAttribute('tabindex', '-1');

      const title = document.createElement('h1');
      title.textContent = 'Class-based Content Post';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'text-neutral-content';
      contentDiv.textContent = 'Content with class selector.';

      mainPost.appendChild(title);
      mainPost.appendChild(contentDiv);
      document.body.appendChild(mainPost);

      const result = getRedditPostContext();

      expect(result.title).toBe('Class-based Content Post');
      expect(result.content).toBe('Content with class selector.');
    });

    it('should ignore comment posts and find main post', () => {
      // Add a comment post (should be ignored)
      const commentPost = document.createElement('shreddit-post');
      commentPost.setAttribute('id', 't1_comment123');
      const commentTitle = document.createElement('h1');
      commentTitle.textContent = 'Comment Title';
      commentPost.appendChild(commentTitle);
      document.body.appendChild(commentPost);

      // Add the main post
      const mainPost = document.createElement('shreddit-post');
      mainPost.setAttribute('id', 't3_mainpost');
      const mainTitle = document.createElement('h1');
      mainTitle.setAttribute('id', 'post-title-mainpost');
      mainTitle.textContent = 'Main Post Title';
      const mainContent = document.createElement('div');
      mainContent.setAttribute('slot', 'text-body');
      mainContent.textContent = 'Main post content.';
      mainPost.appendChild(mainTitle);
      mainPost.appendChild(mainContent);
      document.body.appendChild(mainPost);

      const result = getRedditPostContext();

      expect(result.title).toBe('Main Post Title');
      expect(result.content).toBe('Main post content.');
    });
  });

  describe('Fallback Behavior', () => {
    it('should use fallback selectors when main post container not found', () => {
      const main = document.createElement('main');

      const title = document.createElement('h1');
      title.setAttribute('id', 'post-title-fallback');
      title.textContent = 'Fallback Title';

      const content = document.createElement('div');
      content.setAttribute('slot', 'text-body');
      content.textContent = 'Fallback content.';

      main.appendChild(title);
      main.appendChild(content);
      document.body.appendChild(main);

      const result = getRedditPostContext();

      expect(result.title).toBe('Fallback Title');
      expect(result.content).toBe('Fallback content.');
    });

    it('should return empty strings when no elements found', () => {
      const result = getRedditPostContext();

      expect(result.title).toBe('');
      expect(result.content).toBe('');
    });
  });

  describe('Content Length Limiting', () => {
    it('should limit content to 1000 characters', () => {
      const mainPost = document.createElement('shreddit-post');
      mainPost.setAttribute('tabindex', '-1');

      const title = document.createElement('h1');
      title.textContent = 'Long Content Post';

      const contentDiv = document.createElement('div');
      contentDiv.setAttribute('slot', 'text-body');
      // Create content longer than 1000 chars
      contentDiv.textContent = 'A'.repeat(1500);

      mainPost.appendChild(title);
      mainPost.appendChild(contentDiv);
      document.body.appendChild(mainPost);

      const result = getRedditPostContext();

      expect(result.title).toBe('Long Content Post');
      expect(result.content.length).toBe(1000);
      expect(result.content).toBe('A'.repeat(1000));
    });
  });

  describe('Whitespace Handling', () => {
    it('should trim whitespace from title and content', () => {
      const mainPost = document.createElement('shreddit-post');
      mainPost.setAttribute('tabindex', '-1');

      const title = document.createElement('h1');
      title.textContent = '  Title with spaces  ';

      const contentDiv = document.createElement('div');
      contentDiv.setAttribute('slot', 'text-body');
      contentDiv.textContent = '  Content with spaces  ';

      mainPost.appendChild(title);
      mainPost.appendChild(contentDiv);
      document.body.appendChild(mainPost);

      const result = getRedditPostContext();

      expect(result.title).toBe('Title with spaces');
      expect(result.content).toBe('Content with spaces');
    });
  });

  describe('Error Handling', () => {
    it('should return empty strings on error', () => {
      // Force an error by making querySelector throw
      document.querySelector = () => {
        throw new Error('Test error');
      };

      const result = getRedditPostContext();

      expect(result.title).toBe('');
      expect(result.content).toBe('');
    });
  });
});