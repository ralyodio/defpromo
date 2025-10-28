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
 * @param {Object} params.pageContext - Current page context (optional)
 * @returns {Promise<string[]>} Array of generated variations
 */
export const generateVariations = async ({ count = 5, pageContext, ...params }) => {
  if (!params.apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = buildPrompt({
    ...params,
    pageContext,
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
              'You are a helpful social media expert. Generate authentic, contextual content that provides value. For comments, be genuinely helpful to the original poster while naturally mentioning relevant products when appropriate. Return each variation as a plain text string, one per line, without JSON formatting, numbering, or markdown.',
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
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    // Split by double newlines or numbered lists, clean up
    const variations = content
      .split(/\n\n+|\n\d+\.\s+/)
      .map(v => v.trim())
      .filter(v => v.length > 10)
      .slice(0, count);

    // Ensure we always return an array
    if (!Array.isArray(variations) || variations.length === 0) {
      return [content.trim()];
    }

    return variations;
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
  pageContext,
  requestVariations,
  variationCount,
}) => {
  let prompt = '';

  if (type === 'comment' && pageContext) {
    // Context-aware comment generation
    prompt = `You are viewing this post:

Title: ${pageContext.title || 'N/A'}
Content: ${pageContext.content || 'N/A'}

Generate ${variationCount} helpful, authentic comments that:
1. Provide genuine value and insight related to the post
2. Answer questions or add useful perspective
3. Naturally mention "${productName}" ONLY if truly relevant to helping the poster
4. Don't be salesy - be a helpful community member first

Product Info (use sparingly, only when relevant):
- ${productName}: ${description}
${keyFeatures?.length > 0 ? `- Key features: ${keyFeatures.join(', ')}` : ''}

Tone: ${tone}

Generate ${variationCount} variations, each on its own line, separated by blank lines. No numbering, no JSON, just plain text comments.`;
  } else {
    // Generic post generation
    prompt = `Generate ${type === 'post' ? 'a social media post' : 'a comment'} to subtly promote "${productName}".

Product Description: ${description}`;

    if (targetAudience) {
      prompt += `\nTarget Audience: ${targetAudience}`;
    }

    if (keyFeatures?.length > 0) {
      prompt += `\nKey Features: ${keyFeatures.join(', ')}`;
    }

    prompt += `\nTone: ${tone}`;

    if (requestVariations) {
      prompt += `\n\nGenerate ${variationCount} different variations. Each should be unique and approach the promotion from a different angle. Return each variation as plain text, one per line, separated by blank lines. No numbering, no JSON formatting.`;
    } else {
      prompt += `\n\nMake it engaging, authentic, and not overly promotional. Keep it concise and natural.`;
    }
  }

  return prompt;
};

/**
 * Generate project metadata from scraped content
 * @param {Object} params - Parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.url - Product URL
 * @param {string} params.title - Page title
 * @param {string} params.metaDescription - Meta description
 * @param {string} params.pageText - Page text content
 * @returns {Promise<Object>} Generated project metadata
 */
export const generateProjectMetadata = async ({
  apiKey,
  url,
  title,
  metaDescription,
  pageText,
}) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = `Analyze this website and generate structured project metadata for a promotional content tool.

URL: ${url}
Title: ${title || 'N/A'}
Meta Description: ${metaDescription || 'N/A'}
Page Content (first 1000 chars): ${pageText?.substring(0, 1000) || 'N/A'}

Generate a JSON object with:
- name: A concise product/project name (max 50 chars)
- description: A clear, marketing-focused description (100-200 chars)
- targetAudience: Who this product is for (50-100 chars)
- keyFeatures: Array of 3-5 key features/benefits (each 20-50 chars)
- tone: Suggested tone for promotion (one of: professional, casual, enthusiastic, technical, friendly)

Return ONLY valid JSON, no markdown or explanation.`;

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
              'You are a marketing analyst. Analyze website content and generate structured metadata for promotional purposes. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '{}';

    // Parse JSON response
    try {
      const metadata = JSON.parse(content);
      return {
        name: metadata.name || title || new URL(url).hostname,
        description: metadata.description || metaDescription || '',
        targetAudience: metadata.targetAudience || '',
        keyFeatures: Array.isArray(metadata.keyFeatures) ? metadata.keyFeatures : [],
        tone: metadata.tone || 'professional',
      };
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      // Fallback to basic metadata
      return {
        name: title || new URL(url).hostname,
        description: metaDescription || '',
        targetAudience: '',
        keyFeatures: [],
        tone: 'professional',
      };
    }
  } catch (error) {
    console.error('OpenAI metadata generation error:', error);
    throw error;
  }
};