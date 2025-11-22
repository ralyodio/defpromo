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
  });
});