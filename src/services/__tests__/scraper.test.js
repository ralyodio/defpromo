import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scrapeUrl, extractProductInfo } from '../scraper.js';

// Mock fetch globally
global.fetch = vi.fn();

// Mock DOMParser for browser environment
global.DOMParser = class DOMParser {
  parseFromString(html) {
    // Simple mock implementation
    return {
      querySelector: (selector) => {
        if (selector === 'title') return { textContent: 'Test Product' };
        if (selector === 'h1') return { textContent: 'Test Product' };
        if (selector === 'meta[name="description"]') {
          return { getAttribute: () => 'Test description' };
        }
        return null;
      },
      querySelectorAll: () => [],
      body: { textContent: 'Test Product Description' },
    };
  }
};

describe('Scraper Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scrapeUrl', () => {
    it('should scrape URL using ScrapingBee', async () => {
      const mockHtml = '<html><body><h1>Test Product</h1></body></html>';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      });

      const result = await scrapeUrl({
        url: 'https://example.com',
        apiKey: 'test-key',
        service: 'scrapingbee',
      });

      expect(result).toBe(mockHtml);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should throw error when API key is missing', async () => {
      await expect(
        scrapeUrl({
          url: 'https://example.com',
          service: 'scrapingbee',
        })
      ).rejects.toThrow('API key is required');
    });

    it('should throw error when URL is missing', async () => {
      await expect(
        scrapeUrl({
          apiKey: 'test-key',
          service: 'scrapingbee',
        })
      ).rejects.toThrow('URL is required');
    });
  });

  describe('extractProductInfo', () => {
    it('should extract product information from HTML', () => {
      const html = '<html><head><title>Test</title></head><body>Content</body></html>';

      const result = extractProductInfo(html);

      expect(result.title).toBeTruthy();
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('text');
    });

    it('should return empty object for invalid HTML', () => {
      const result = extractProductInfo('');

      expect(result.title).toBe('');
      expect(result.description).toBe('');
    });
  });
});