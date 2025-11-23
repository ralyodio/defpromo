/**
 * OpenAI Service
 * Handles AI content generation using OpenAI's API
 */

import { recordApiUsage, calculateCost } from './apiCost.js';
import { logError, logDebug } from './logger.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Generate promotional content using OpenAI
 * @param {Object} params - Generation parameters
 * @param {string} params.apiKey - OpenAI API key
 * @param {string} params.projectId - Project ID for cost tracking (optional)
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
  projectId,
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
    
    // Record API usage for cost tracking
    if (projectId && data.usage) {
      try {
        const cost = calculateCost({
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        });
        
        await recordApiUsage({
          projectId,
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          cost,
        });
      } catch (costError) {
        await logError('Failed to record API usage in generateContent', {
          error: costError.message,
          projectId,
        });
        // Don't throw - cost tracking failure shouldn't break the main flow
      }
    }
    
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    await logError('OpenAI generation error', {
      error: error.message,
      projectId,
      productName,
    });
    throw error;
  }
};

/**
 * Generate multiple content variations
 * @param {Object} params - Generation parameters
 * @param {string} params.projectId - Project ID for cost tracking (optional)
 * @param {number} params.count - Number of variations to generate (default: 5)
 * @param {Object} params.pageContext - Current page context (optional)
 * @param {string} params.platform - Platform name for platform-specific constraints (optional)
 * @param {boolean} params.includeLink - Whether to include product link (optional)
 * @param {string} params.productUrl - Product URL to include (optional)
 * @param {boolean} params.generateTitle - Whether to generate a title for the post (optional)
 * @returns {Promise<string[]|Object>} Array of generated variations, or object with title and variations
 */
export const generateVariations = async ({ projectId, count = 5, pageContext, platform, includeLink = false, productUrl = '', generateTitle = false, ...params }) => {
  if (!params.apiKey) {
    throw new Error('OpenAI API key is required');
  }

  const prompt = buildPrompt({
    ...params,
    pageContext,
    platform,
    includeLink,
    productUrl,
    requestVariations: true,
    variationCount: count,
    generateTitle,
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
              'You are a helpful social media expert. Generate authentic, contextual content that provides value. For posts, write naturally in multiple paragraphs like a real person sharing their experience. For comments, be genuinely helpful to the original poster while naturally mentioning relevant products when appropriate. Avoid AI-sounding language, corporate speak, and obvious marketing patterns. Write conversationally with natural flow and rhythm.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.9,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Record API usage for cost tracking
    if (projectId && data.usage) {
      try {
        const cost = calculateCost({
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        });
        
        await recordApiUsage({
          projectId,
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          cost,
        });
      } catch (costError) {
        await logError('Failed to record API usage in generateVariations', {
          error: costError.message,
          projectId,
        });
      }
    }
    
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      throw new Error('No content generated from OpenAI');
    }

    // If title generation was requested, parse title and content separately
    if (generateTitle) {
      const titleMatch = content.match(/^TITLE:\s*(.+?)(?:\n|$)/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      // Remove title line from content
      const contentWithoutTitle = titleMatch
        ? content.substring(titleMatch[0].length).trim()
        : content;
      
      // Split variations
      const variations = contentWithoutTitle
        .split(/\n\n+|\n\d+\.\s+/)
        .map(v => v.trim())
        .filter(v => v.length > 10)
        .slice(0, count);

      // Return object with title and variations
      return {
        title,
        variations: variations.length > 0 ? variations : [contentWithoutTitle.trim()],
      };
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
    await logError('OpenAI variations error', {
      error: error.message,
      projectId,
      count,
    });
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
  platform,
  includeLink,
  productUrl,
  requestVariations,
  variationCount,
  generateTitle,
}) => {
  let prompt = '';

  // Platform-specific character limits
  const platformLimits = {
    tiktok: 150,
    twitter: 280,
    // Add more as needed
  };

  const charLimit = platform ? platformLimits[platform.toLowerCase()] : null;

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
${includeLink && productUrl ? `6. Include the link ${productUrl} naturally in the comment` : ''}
${charLimit ? `${includeLink ? '7' : '6'}. CRITICAL: Keep each comment under ${charLimit} characters (${platform} limit)` : ''}

Your Product/Service to mention:
- Name: ${productName}
- Description: ${description}
${keyFeatures?.length > 0 ? `- Key features: ${keyFeatures.join(', ')}` : ''}
${includeLink && productUrl ? `- Link: ${productUrl}` : ''}

Tone: ${tone}

IMPORTANT: Each comment MUST include a natural, subtle reference to "${productName}" while being genuinely helpful. Think of it as recommending a tool you personally use and find valuable for situations like the one in the post.
${includeLink && productUrl ? `\nInclude the link ${productUrl} naturally - don't just append it, weave it into the comment contextually.` : ''}
${charLimit ? `\nCRITICAL CHARACTER LIMIT: Each comment MUST be under ${charLimit} characters. Count carefully!` : ''}

Generate ${variationCount} variations, each on its own line, separated by blank lines. No numbering, no JSON, just plain text comments.`;
  } else if (type === 'post') {
    // Post generation - more substantial content
    const needsTitle = generateTitle;
    
    prompt = `Generate ${variationCount} engaging, authentic social media posts to promote "${productName}".

Product Description: ${description}`;

    if (targetAudience) {
      prompt += `\nTarget Audience: ${targetAudience}`;
    }

    if (keyFeatures?.length > 0) {
      prompt += `\nKey Features: ${keyFeatures.join(', ')}`;
    }

    if (includeLink && productUrl) {
      prompt += `\nProduct Link: ${productUrl}`;
    }

    prompt += `\nTone: ${tone}`;
    prompt += `\n${charLimit ? `Character Limit: ${charLimit} (${platform})` : ''}`;

    if (needsTitle) {
      prompt += `\n\n⚠️ IMPORTANT: First line MUST be the title in this exact format:
TITLE: Your catchy title here (max 300 characters)

Then provide ${variationCount} post variations below.`;
    }

    prompt += `\n\nCreate ${variationCount} unique, long-form social media posts that:

CRITICAL REQUIREMENTS:
1. Write in MULTIPLE PARAGRAPHS (2-4 paragraphs per post)
2. Each paragraph should be 2-4 sentences long
3. Use natural paragraph breaks (double line breaks between paragraphs)
4. Write like a REAL PERSON sharing their experience or insights
5. Avoid obvious AI patterns like:
   - Overly formal language
   - Bullet points or numbered lists in the post body
   - Generic phrases like "game-changer" or "revolutionize"
   - Excessive use of emojis or hashtags
   - Corporate marketing speak

CONTENT STYLE:
- Start with a relatable hook or personal observation
- Build context naturally in the middle paragraphs
- Mention the product organically as part of the narrative
- End with genuine reflection or subtle call-to-action
- Use conversational language with natural flow
- Include specific details that make it feel authentic
- Vary sentence length and structure for natural rhythm

${includeLink && productUrl ? `LINK INTEGRATION:
- Weave the link ${productUrl} naturally into the narrative
- Don't just append it at the end
- Make it feel like a natural reference point in your story
` : ''}

${charLimit ? `CHARACTER LIMIT: Stay under ${charLimit} characters total (${platform})
` : 'LENGTH: Aim for 200-400 words per post (substantial but not overwhelming)'}

Each post should take a different narrative approach:
1. Personal discovery story (how you found/started using it)
2. Problem-to-solution journey (specific challenge it solved)
3. Behind-the-scenes insight (what makes it different)
4. Comparative perspective (why you chose this over alternatives)
5. Future-focused vision (how it's changing your workflow/life)

${needsTitle ? `\n⚠️ REMEMBER: Start your response with "TITLE: [your title]" on the first line!\n` : ''}

FORMATTING:
- Use double line breaks between paragraphs
- Write naturally without markdown formatting
- No bullet points, no numbered lists in post body
- No hashtags within the post text (save those for the end if needed)

Return each variation as plain text with natural paragraph breaks, separated by blank lines between variations. No numbering, no JSON formatting.`;
  } else {
    // Generic comment generation (fallback)
    prompt = `Generate a comment to subtly promote "${productName}".

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
  projectId,
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
    
    // Record API usage for cost tracking
    if (projectId && data.usage) {
      try {
        const cost = calculateCost({
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        });
        
        await recordApiUsage({
          projectId,
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          cost,
        });
      } catch (costError) {
        await logError('Failed to record API usage in generateProjectMetadata', {
          error: costError.message,
          projectId,
        });
      }
    }
    
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
      await logError('Failed to parse OpenAI metadata response', {
        error: parseError.message,
        projectId,
        url,
      });
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
    await logError('OpenAI metadata generation error', {
      error: error.message,
      projectId,
      url,
    });
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
  projectId,
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
    
    // Record API usage for cost tracking
    if (projectId && data.usage) {
      try {
        const cost = calculateCost({
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        });
        
        await recordApiUsage({
          projectId,
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          cost,
        });
      } catch (costError) {
        await logError('Failed to record API usage in suggestSubreddits', {
          error: costError.message,
          projectId,
        });
      }
    }
    
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      return [];
    }

    await logDebug('Raw subreddit response received', { projectId, contentLength: content.length });

    // Try to parse as JSON first
    try {
      const subreddits = JSON.parse(content);
      if (Array.isArray(subreddits)) {
        return subreddits.slice(0, 10);
      }
    } catch (parseError) {
      await logDebug('Subreddit response not JSON, trying text parsing', { projectId });
    }

    // Fallback: Parse as text (comma-separated, line-separated, or with r/ prefix)
    const subreddits = content
      .split(/[,\n]+/)
      .map(s => s.trim())
      .map(s => s.replace(/^r\//, '')) // Remove r/ prefix if present
      .map(s => s.replace(/[^\w-]/g, '')) // Remove any non-alphanumeric except hyphens
      .filter(s => s.length > 0)
      .slice(0, 10);

    await logDebug('Parsed subreddits', { projectId, count: subreddits.length });
    return subreddits;
  } catch (error) {
    await logError('Subreddit suggestion error', {
      error: error.message,
      projectId,
      productName,
    });
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

    await logDebug('Raw hashtag response received', { contentLength: content.length });

    // Try to parse as JSON first
    try {
      const hashtags = JSON.parse(content);
      if (Array.isArray(hashtags)) {
        return hashtags.slice(0, 10);
      }
    } catch (parseError) {
      await logDebug('Hashtag response not JSON, trying text parsing');
    }

    // Fallback: Parse as text
    const hashtags = content
      .split(/[,\n]+/)
      .map(h => h.trim())
      .map(h => h.replace(/^#/, '')) // Remove # prefix if present
      .map(h => h.replace(/[^\w]/g, '')) // Remove any non-alphanumeric
      .filter(h => h.length > 0)
      .slice(0, 10);

    await logDebug('Parsed hashtags', { count: hashtags.length });
    return hashtags;
  } catch (error) {
    await logError('Hashtag suggestion error', {
      error: error.message,
      productName,
    });
    throw error;
  }
};

/**
 * Suggest subreddits, hashtags, and search keywords in a single API call
 * @param {Object} params - Parameters
 * @param {string} params.projectId - Project ID for cost tracking (optional)
 * @returns {Promise<{subreddits: string[], hashtags: string[], searchKeywords: string[]}>}
 */
export const suggestSubredditsAndHashtags = async ({
  apiKey,
  projectId,
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
2. Top 10 relevant hashtags for social media (Twitter/X, Instagram, Threads)
3. Top 10 search keywords for platforms without hashtag support (Facebook, YouTube, LinkedIn)

Product: ${productName}
Description: ${description}
Target Audience: ${targetAudience || 'General'}
Key Features: ${keyFeatures?.join(', ') || 'N/A'}
${keywords ? `Additional Keywords: ${keywords}` : ''}

Return ONLY a JSON object with this exact structure:
{
  "subreddits": ["subreddit1", "subreddit2", ...],
  "hashtags": ["hashtag1", "hashtag2", ...],
  "searchKeywords": ["keyword1", "keyword2", ...]
}

Subreddits should:
- Have active communities
- Allow helpful engagement
- Match the niche
- Be specific (not too generic)

Hashtags should:
- Be actively searched on Twitter/X, Instagram, Threads
- Match the product niche
- Mix popular and niche tags
- Be specific enough to be useful

Search Keywords should:
- Work well in Facebook, YouTube, LinkedIn search
- Be phrases people actually search for
- Include both broad and specific terms
- Help discover relevant content and communities`;

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
    
    // Record API usage for cost tracking
    if (projectId && data.usage) {
      try {
        const cost = calculateCost({
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        });
        
        await recordApiUsage({
          projectId,
          service: 'openai',
          model: DEFAULT_MODEL,
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
          cost,
        });
      } catch (costError) {
        await logError('Failed to record API usage in suggestSubredditsAndHashtags', {
          error: costError.message,
          projectId,
        });
      }
    }
    
    const content = data.choices[0]?.message?.content || '';

    if (!content) {
      return { subreddits: [], hashtags: [], searchKeywords: [] };
    }

    await logDebug('Raw combined suggestions response received', {
      projectId,
      contentLength: content.length,
    });

    // Try to parse as JSON
    try {
      const result = JSON.parse(content);
      
      // Clean up subreddits - remove r/ prefix if present
      const cleanSubreddits = Array.isArray(result.subreddits)
        ? result.subreddits
            .map(s => s.trim())
            .map(s => s.replace(/^r\//, '')) // Remove r/ prefix
            .map(s => s.replace(/[^\w-]/g, '')) // Remove non-alphanumeric except hyphens
            .filter(s => s.length > 0)
            .slice(0, 10)
        : [];
      
      // Clean up hashtags - remove # prefix if present
      const cleanHashtags = Array.isArray(result.hashtags)
        ? result.hashtags
            .map(h => h.trim())
            .map(h => h.replace(/^#/, '')) // Remove # prefix
            .map(h => h.replace(/[^\w]/g, '')) // Remove non-alphanumeric
            .filter(h => h.length > 0)
            .slice(0, 10)
        : [];
      
      // Clean up search keywords
      const cleanSearchKeywords = Array.isArray(result.searchKeywords)
        ? result.searchKeywords
            .map(k => k.trim())
            .filter(k => k.length > 0)
            .slice(0, 10)
        : [];
      
      return {
        subreddits: cleanSubreddits,
        hashtags: cleanHashtags,
        searchKeywords: cleanSearchKeywords,
      };
    } catch (parseError) {
      await logError('Failed to parse combined suggestions', {
        error: parseError.message,
        projectId,
      });
      return { subreddits: [], hashtags: [], searchKeywords: [] };
    }
  } catch (error) {
    await logError('Combined suggestion error', {
      error: error.message,
      projectId,
      productName,
    });
    throw error;
  }
};