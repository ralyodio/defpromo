/**
 * Web Scraper Service
 * Handles web scraping using external APIs (ScrapingBee, ScraperAPI, or Browserless)
 */

/**
 * Scrape a URL using the configured scraping service
 * @param {Object} params - Scraping parameters
 * @param {string} params.url - URL to scrape
 * @param {string} params.apiKey - Scraper API key
 * @param {string} params.service - Scraping service ('scrapingbee', 'scraperapi', 'browserless')
 * @returns {Promise<string>} HTML content
 */
export const scrapeUrl = async ({ url, apiKey, service = 'scrapingbee' }) => {
  if (!url) {
    throw new Error('URL is required for scraping');
  }

  if (!apiKey) {
    throw new Error('API key is required for scraping');
  }

  try {
    let scraperUrl;
    let options = {};

    switch (service) {
      case 'scrapingbee':
        scraperUrl = `https://app.scrapingbee.com/api/v1/?api_key=${apiKey}&url=${encodeURIComponent(url)}&render_js=true`;
        break;

      case 'scraperapi':
        scraperUrl = `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=true`;
        break;

      case 'browserless':
        scraperUrl = `https://production-sfo.browserless.io/content?token=${apiKey}`;
        options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: url,
          }),
        };
        break;

      default:
        throw new Error(`Unknown scraping service: ${service}`);
    }

    const response = await fetch(scraperUrl, options);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Scraping failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const html = await response.text();
    return html;
  } catch (error) {
    console.error('Scraping error:', error);
    
    // Provide more helpful error messages
    if (error.message?.includes('NetworkError') || error.message?.includes('Failed to fetch')) {
      throw new Error(
        'Network error: Unable to connect to scraping service. Please check your internet connection and ensure the extension has the necessary permissions.'
      );
    }
    
    throw error;
  }
};

/**
 * Extract product information from HTML content
 * @param {string} html - HTML content
 * @returns {Object} Extracted product information
 */
export const extractProductInfo = (html) => {
  if (!html) {
    return {
      title: '',
      description: '',
      text: '',
    };
  }

  try {
    // Create a DOM parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract title
    const title =
      doc.querySelector('title')?.textContent ||
      doc.querySelector('h1')?.textContent ||
      '';

    // Extract meta description
    const metaDescription =
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
      '';

    // Extract main text content (remove scripts and styles)
    const scripts = doc.querySelectorAll('script, style, noscript');
    scripts.forEach((el) => el.remove());

    const bodyText = doc.body?.textContent || '';
    const cleanText = bodyText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000); // Limit to 2000 chars

    return {
      title: title.trim(),
      description: metaDescription.trim(),
      text: cleanText,
    };
  } catch (error) {
    console.error('HTML parsing error:', error);
    return {
      title: '',
      description: '',
      text: '',
    };
  }
};

/**
 * Scrape and extract product information in one call
 * @param {Object} params - Parameters
 * @returns {Promise<Object>} Extracted product information
 */
export const scrapeAndExtract = async (params) => {
  const html = await scrapeUrl(params);
  return extractProductInfo(html);
};