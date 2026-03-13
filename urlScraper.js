// =============================================================
//  urlScraper.js — NewsMind.AI
//  Strategy 1: @mozilla/readability + jsdom  (best for news sites)
//  Strategy 2: Cheerio paragraph extraction  (fallback)
//  No Puppeteer, no API keys, completely free
// =============================================================

const axios = require('axios');
const cheerio = require('cheerio');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

// Rotate user agents to reduce blocking
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

class URLScraperService {
  constructor() {
    console.log('🌐 URL Scraper Service initialized (Readability + Cheerio)');
  }

  // ── Fetch raw HTML from URL ────────────────────────────────────
  async _fetchHTML(url) {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': randomAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.google.com/',
      },
      timeout: 15000,
      maxRedirects: 5,
    });
    return response.data;
  }

  // ── Strategy 1: Mozilla Readability ───────────────────────────
  // Best for news articles — strips ads, nav, sidebars automatically
  _extractWithReadability(html, url) {
    try {
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (article && article.textContent && article.textContent.trim().length > 200) {
        console.log(`[Readability] ✅ Extracted ${article.textContent.length} chars`);
        return {
          title: article.title || '',
          content: article.textContent.replace(/\s+/g, ' ').trim(),
        };
      }
      return null;
    } catch (err) {
      console.warn('[Readability] ⚠️ Failed:', err.message);
      return null;
    }
  }

  // ── Strategy 2: Cheerio paragraph extraction ──────────────────
  // Fallback — grabs all <p> tags and filters noise
  _extractWithCheerio(html, url) {
    try {
      const $ = cheerio.load(html);

      // Get title
      let title =
        $('meta[property="og:title"]').attr('content') ||
        $('h1').first().text().trim() ||
        $('title').text().trim() ||
        'Article from ' + new URL(url).hostname;

      // Remove noise
      $('script, style, nav, header, footer, aside, .ad, .advertisement, .sidebar, .comments, iframe, noscript').remove();

      // Try article selectors first
      const articleSelectors = [
        'article', '[role="main"]', 'main',
        '.article-content', '.post-content', '.entry-content',
        '.article-body', '.story-body', '.content-body',
        '#article-body', '#main-content', '.news-article',
      ];

      let content = '';
      for (const selector of articleSelectors) {
        const el = $(selector);
        if (el.length > 0) {
          content = el.text().replace(/\s+/g, ' ').trim();
          if (content.length > 300) break;
        }
      }

      // Fallback to paragraphs
      if (!content || content.length < 300) {
        const paragraphs = $('p')
          .map((i, el) => $(el).text().trim())
          .get()
          .filter(p => p.length > 40);
        content = paragraphs.join('\n\n');
      }

      content = content.replace(/\s+/g, ' ').trim();

      if (content.length > 200) {
        console.log(`[Cheerio] ✅ Extracted ${content.length} chars`);
        return { title, content };
      }
      return null;
    } catch (err) {
      console.warn('[Cheerio] ⚠️ Failed:', err.message);
      return null;
    }
  }

  // ── Main scrape method ─────────────────────────────────────────
  async scrapeURL(url) {
    console.log('🔍 Scraping URL:', url);

    // Validate URL format
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format. Please include https://');
    }

    let html;
    try {
      html = await this._fetchHTML(url);
    } catch (error) {
      if (error.code === 'ENOTFOUND')   throw new Error('URL not found or unreachable. Check the link.');
      if (error.code === 'ETIMEDOUT')   throw new Error('Request timed out. The site is too slow or down.');
      if (error.response?.status === 403) throw new Error('Access forbidden — this site blocks automated access.');
      if (error.response?.status === 404) throw new Error('Article not found (404). The link may be broken.');
      if (error.response?.status === 429) throw new Error('Rate limited by the website. Try again in a minute.');
      throw new Error(`Could not fetch URL: ${error.message}`);
    }

    // Strategy 1: Readability (best for news)
    let result = this._extractWithReadability(html, url);

    // Strategy 2: Cheerio fallback
    if (!result) {
      console.log('[Scraper] Readability failed, trying Cheerio fallback...');
      result = this._extractWithCheerio(html, url);
    }

    // Both failed
    if (!result) {
      throw new Error(
        'Could not extract article content. The site may use heavy JavaScript rendering or block scrapers. Try a different URL.'
      );
    }

    return {
      title: result.title || 'Untitled',
      content: result.content,
      url,
      wordCount: result.content.split(/\s+/).length,
    };
  }
}

module.exports = new URLScraperService();