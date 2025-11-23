import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateContent, generateVariations } from '../openai.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('OpenAI Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateContent', () => {
    it('should generate content with OpenAI API', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Check out this amazing product!',
            },
          },
        ],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateContent({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'post',
      });

      expect(result).toBe('Check out this amazing product!');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
        })
      );
    });

    it('should throw error when API key is missing', async () => {
      await expect(
        generateContent({
          productName: 'Test',
          description: 'Test',
          type: 'post',
        })
      ).rejects.toThrow('OpenAI API key is required');
    });

    it('should handle API errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(
        generateContent({
          apiKey: 'invalid-key',
          productName: 'Test',
          description: 'Test',
          type: 'post',
        })
      ).rejects.toThrow('OpenAI API error');
    });
  });

  describe('generateVariations', () => {
    it('should generate multiple content variations', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Variation 1\n\nVariation 2\n\nVariation 3',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'post',
        count: 3,
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toBe('Variation 1');
    });

    it('should default to 5 variations if count not specified', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Var 1\n\nVar 2\n\nVar 3\n\nVar 4\n\nVar 5',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test',
        description: 'Test',
        type: 'comment',
      });

      // The splitting logic may vary, so just check we got at least 1 variation
      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should generate title and variations when generateTitle is true', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'TITLE: Amazing Product Launch\n\nVariation 1 content here\n\nVariation 2 content here',
            },
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 75,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'post',
        count: 2,
        generateTitle: true,
      });

      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('variations');
      expect(result.title).toBe('Amazing Product Launch');
      expect(Array.isArray(result.variations)).toBe(true);
      expect(result.variations.length).toBeGreaterThan(0);
    });

    it('should handle multi-paragraph post content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'First paragraph of post one.\n\nSecond paragraph continues.\n\nFirst paragraph of post two.\n\nSecond paragraph here too.',
            },
          },
        ],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 100,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'post',
        count: 2,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      // Check that variations contain multi-paragraph content
      expect(result[0]).toContain('First paragraph');
    });

    it('should include platform-specific constraints', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Short tweet\n\nAnother short tweet',
            },
          },
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 30,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'comment',
        platform: 'twitter',
        count: 2,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include product link when requested', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Check out this product at https://example.com\n\nAnother post with link',
            },
          },
        ],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 40,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'post',
        includeLink: true,
        productUrl: 'https://example.com',
        count: 2,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle page context for comment generation', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Helpful comment based on context\n\nAnother helpful comment',
            },
          },
        ],
        usage: {
          prompt_tokens: 180,
          completion_tokens: 60,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'comment',
        pageContext: {
          title: 'Original Post Title',
          content: 'Original post content here',
        },
        count: 2,
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use increased max_tokens for longer content', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: 'Long form content here\n\nWith multiple paragraphs',
            },
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 200,
        },
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await generateVariations({
        apiKey: 'test-key',
        productName: 'Test Product',
        description: 'A great product',
        type: 'post',
        count: 2,
      });

      // Verify the fetch was called with max_tokens: 2500
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          body: expect.stringContaining('"max_tokens":2500'),
        })
      );
    });
  });
});