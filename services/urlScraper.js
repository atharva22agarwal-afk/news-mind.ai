const axios = require('axios');
const cheerio = require('cheerio');

class URLScraperService {
  constructor() {
    console.log('🌐 URL Scraper Service initialized');
  }

  async scrapeURL(url) {
    try {
      console.log('🔍 Fetching URL:', url);

      // Fetch the webpage
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000 // 10 second timeout
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Extract title
      let title = $('title').text().trim();
      if (!title) {
        title = $('h1').first().text().trim();
      }
      if (!title) {
        title = 'Article from ' + new URL(url).hostname;
      }

      // Remove script and style elements
      $('script, style, nav, header, footer, aside, .ad, .advertisement').remove();

      // Try to find main content
      let content = '';
      
      // Common article selectors
      const articleSelectors = [
        'article',
        '[role="main"]',
        '.article-content',
        '.post-content',
        '.entry-content',
        '.content',
        'main',
        '.story-body',
        '.article-body'
      ];

      // Try each selector
      for (const selector of articleSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          content = element.text().trim();
          if (content.length > 200) {
            break;
          }
        }
      }

      // If no article content found, try paragraphs
      if (!content || content.length < 200) {
        const paragraphs = $('p')
          .map((i, el) => $(el).text().trim())
          .get()
          .filter(p => p.length > 50);
        
        content = paragraphs.join('\n\n');
      }

      // Clean up the content
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

      if (!content || content.length < 100) {
        throw new Error('Could not extract meaningful content from URL');
      }

      console.log('✅ Content extracted:', content.length, 'characters');

      return {
        title,
        content,
        url,
        wordCount: content.split(/\s+/).length
      };
    } catch (error) {
      console.error('❌ URL Scraping Error:', error.message);
      
      if (error.code === 'ENOTFOUND') {
        throw new Error('URL not found or unreachable');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Request timeout - URL took too long to respond');
      } else if (error.response?.status === 403) {
        throw new Error('Access forbidden - website blocks automated access');
      } else if (error.response?.status === 404) {
        throw new Error('URL not found (404)');
      }
      
      throw new Error(`Failed to scrape URL: ${error.message}`);
    }
  }
}

module.exports = new URLScraperService();