/**
 * OpenAI Service
 * Handles AI content generation using OpenAI's API
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Generate promotional content using OpenAI
 * @param {Object} params - Generation parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.productName - Product name
 * @param {string} params.description - Product description
 * @param {string} params.type - Content type ('post' or 'comment')
 * @param {string} params.targetAudience - Target audience (optional)
 * @param {string} params.tone - Tone of voice (optional)
 * @param {string[]} params.keyFeatures - Key features (optional)
 * @returns {Promise<string>} Generated content
 */
export const generateContent = async ({
  apiKey,
  productName,
  description,
  type = 'post',
  targetAudience = '',
  tone = 'professional',
  keyFeatures = [],
}) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = buildPrompt({
    productName,
    description,
    type,
    targetAudience,
    tone,
    keyFeatures,
  });

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a social media marketing expert. Generate engaging, authentic promotional content that subtly promotes products without being overly salesy.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('OpenAI generation error:', error);
    throw error;
  }
};

/**
 * Generate multiple content variations
 * @param {Object} params - Generation parameters
 * @param {number} params.count - Number of variations to generate (default: 5)
 * @returns {Promise<string[]>} Array of generated variations
 */
export const generateVariations = async ({ count = 5, ...params }) => {
  if (!params.apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = buildPrompt({
    ...params,
    requestVariations: true,
    variationCount: count,
  });

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a social media marketing expert. Generate multiple variations of promotional content. Return ONLY a JSON array of strings, nothing else.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';

    // Parse JSON response
    try {
      const variations = JSON.parse(content);
      return Array.isArray(variations) ? variations : [content];
    } catch {
      // If not valid JSON, return as single variation
      return [content];
    }
  } catch (error) {
    console.error('OpenAI variations error:', error);
    throw error;
  }
};

/**
 * Build prompt for content generation
 * @private
 */
const buildPrompt = ({
  productName,
  description,
  type,
  targetAudience,
  tone,
  keyFeatures,
  requestVariations,
  variationCount,
}) => {
  let prompt = `Generate ${type === 'post' ? 'a social media post' : 'a comment'} to subtly promote "${productName}".

Product Description: ${description}`;

  if (targetAudience) {
    prompt += `\nTarget Audience: ${targetAudience}`;
  }

  if (keyFeatures?.length > 0) {
    prompt += `\nKey Features: ${keyFeatures.join(', ')}`;
  }

  prompt += `\nTone: ${tone}`;

  if (requestVariations) {
    prompt += `\n\nGenerate ${variationCount} different variations. Each should be unique and approach the promotion from a different angle. Return ONLY a JSON array of strings.`;
  } else {
    prompt += `\n\nMake it engaging, authentic, and not overly promotional. Keep it concise and natural.`;
  }

  return prompt;
};