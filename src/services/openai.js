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
3. Subtly and naturally work in a mention of "${productName}" as part of your helpful response
4. Make the product mention feel organic - like you're sharing a tool that genuinely helps with their situation
5. Don't be overly promotional - be conversational and authentic

Your Product/Service to mention:
- Name: ${productName}
- Description: ${description}
${keyFeatures?.length > 0 ? `- Key features: ${keyFeatures.join(', ')}` : ''}

Tone: ${tone}

IMPORTANT: Each comment MUST include a natural, subtle reference to "${productName}" while being genuinely helpful. Think of it as recommending a tool you personally use and find valuable for situations like the one in the post.

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

/**
 * Suggest relevant subreddits for a product/project
 * @param {Object} params - Parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.productName - Product name
 * @param {string} params.description - Product description
 * @param {string} params.targetAudience - Target audience
 * @param {string[]} params.keyFeatures - Key features
 * @param {string} params.keywords - Additional keywords for targeting (optional)
 * @returns {Promise<string[]>} Array of subreddit names (without r/ prefix)
 */
export const suggestSubreddits = async ({
  apiKey,
  productName,
  description,
  targetAudience,
  keyFeatures,
  keywords,
}) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = `Based on this product, suggest the top 10 most relevant subreddits where the target audience would be active and receptive to helpful, non-spammy engagement.

Product: ${productName}
Description: ${description}
Target Audience: ${targetAudience || 'General'}
Key Features: ${keyFeatures?.join(', ') || 'N/A'}
${keywords ? `Additional Keywords: ${keywords}` : ''}

Return ONLY a JSON array of subreddit names (without the r/ prefix), ordered by relevance. Example: ["entrepreneur", "startups", "SaaS"]

Focus on subreddits that:
1. Have active communities
2. Allow self-promotion in comments (when providing value)
3. Match the target audience and keywords
4. Are receptive to helpful product mentions
5. Are specific and niche (not too generic)`;

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
              'You are a Reddit marketing expert. Suggest relevant subreddits for products. Always return valid JSON arrays.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      return [];
    }

    console.log('Raw subreddit response:', content);

    // Try to parse as JSON first
    try {
      const subreddits = JSON.parse(content);
      if (Array.isArray(subreddits)) {
        return subreddits.slice(0, 10);
      }
    } catch (parseError) {
      console.log('Not JSON, trying text parsing');
    }

    // Fallback: Parse as text (comma-separated, line-separated, or with r/ prefix)
    const subreddits = content
      .split(/[,\n]+/)
      .map(s => s.trim())
      .map(s => s.replace(/^r\//, '')) // Remove r/ prefix if present
      .map(s => s.replace(/[^\w-]/g, '')) // Remove any non-alphanumeric except hyphens
      .filter(s => s.length > 0)
      .slice(0, 10);

    console.log('Parsed subreddits:', subreddits);
    return subreddits;
  } catch (error) {
    console.error('Subreddit suggestion error:', error);
    throw error;
  }
};

/**
 * Suggest relevant hashtags for social media platforms
 * @param {Object} params - Parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.productName - Product name
 * @param {string} params.description - Product description
 * @param {string} params.targetAudience - Target audience
 * @param {string[]} params.keyFeatures - Key features
 * @param {string} params.keywords - Additional keywords (optional)
 * @returns {Promise<string[]>} Array of hashtags (without # prefix)
 */
export const suggestHashtags = async ({
  apiKey,
  productName,
  description,
  targetAudience,
  keyFeatures,
  keywords,
}) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = `Based on this product, suggest the top 10 most relevant hashtags for social media platforms (Twitter/X, Bluesky, Primal).

Product: ${productName}
Description: ${description}
Target Audience: ${targetAudience || 'General'}
Key Features: ${keyFeatures?.join(', ') || 'N/A'}
${keywords ? `Additional Keywords: ${keywords}` : ''}

Return ONLY a JSON array of hashtag strings (without the # prefix), ordered by relevance. Example: ["SaaS", "ProductHunt", "IndieHackers"]

Focus on hashtags that:
1. Are actively used and searched
2. Match the product niche
3. Attract the target audience
4. Are specific enough to be useful (not too generic like #tech)
5. Mix popular and niche tags`;

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
              'You are a social media marketing expert. Suggest relevant hashtags for products. Always return valid JSON arrays.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      return [];
    }

    console.log('Raw hashtag response:', content);

    // Try to parse as JSON first
    try {
      const hashtags = JSON.parse(content);
      if (Array.isArray(hashtags)) {
        return hashtags.slice(0, 10);
      }
    } catch (parseError) {
      console.log('Not JSON, trying text parsing');
    }

    // Fallback: Parse as text
    const hashtags = content
      .split(/[,\n]+/)
      .map(h => h.trim())
      .map(h => h.replace(/^#/, '')) // Remove # prefix if present
      .map(h => h.replace(/[^\w]/g, '')) // Remove any non-alphanumeric
      .filter(h => h.length > 0)
      .slice(0, 10);

    console.log('Parsed hashtags:', hashtags);
    return hashtags;
  } catch (error) {
    console.error('Hashtag suggestion error:', error);
    throw error;
  }
};

/**
 * Suggest both subreddits and hashtags in a single API call
 * @param {Object} params - Parameters
 * @returns {Promise<{subreddits: string[], hashtags: string[]}>}
 */
export const suggestSubredditsAndHashtags = async ({
  apiKey,
  productName,
  description,
  targetAudience,
  keyFeatures,
  keywords,
}) => {
  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = `Based on this product, suggest:
1. Top 10 relevant subreddits for engagement
2. Top 10 relevant hashtags for social media

Product: ${productName}
Description: ${description}
Target Audience: ${targetAudience || 'General'}
Key Features: ${keyFeatures?.join(', ') || 'N/A'}
${keywords ? `Additional Keywords: ${keywords}` : ''}

Return ONLY a JSON object with this exact structure:
{
  "subreddits": ["subreddit1", "subreddit2", ...],
  "hashtags": ["hashtag1", "hashtag2", ...]
}

Subreddits should:
- Have active communities
- Allow helpful engagement
- Match the niche
- Be specific (not too generic)

Hashtags should:
- Be actively searched
- Match the product niche
- Mix popular and niche tags
- Be specific enough to be useful`;

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
              'You are a social media marketing expert. Suggest relevant subreddits and hashtags. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      return { subreddits: [], hashtags: [] };
    }

    console.log('Raw combined response:', content);

    // Try to parse as JSON
    try {
      const result = JSON.parse(content);
      return {
        subreddits: Array.isArray(result.subreddits) ? result.subreddits.slice(0, 10) : [],
        hashtags: Array.isArray(result.hashtags) ? result.hashtags.slice(0, 10) : [],
      };
    } catch (parseError) {
      console.error('Failed to parse combined suggestions:', parseError);
      return { subreddits: [], hashtags: [] };
    }
  } catch (error) {
    console.error('Combined suggestion error:', error);
    throw error;
  }
};