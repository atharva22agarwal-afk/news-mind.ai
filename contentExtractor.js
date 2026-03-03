const axios = require('axios');
const cheerio = require('cheerio');
const mammoth = require('mammoth');

/**
 * Extract content from URL
 */
async function extractFromURL(url) {
  try {
    console.log(`📡 Fetching content from: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000,
      maxRedirects: 5
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .social-share, .comments, iframe, noscript').remove();
    
    // Try multiple selectors to find main content
    const contentSelectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.article-body',
      '.story-body',
      '.content-body',
      '#content',
      '.content',
      'body'
    ];
    
    let title = $('h1').first().text().trim() || 
                $('title').text().trim() ||
                $('meta[property="og:title"]').attr('content') || 
                'Untitled Article';
    
    let content = '';
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length) {
        content = element.text();
        if (content.length > 300) break;
      }
    }
    
    // Clean up text
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
    
    if (content.length < 100) {
      throw new Error('Could not extract meaningful content from URL. The page might be behind a paywall or require JavaScript.');
    }
    
    console.log(`✅ Extracted ${content.length} characters from URL`);
    
    return {
      title,
      content,
      source: 'url',
      sourceUrl: url
    };
    
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      throw new Error('Could not reach the URL. Please check the URL and your internet connection.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Request timed out. The website might be slow or down.');
    } else {
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }
}
/**
 * Extract text from PDF buffer
 */
async function extractFromPDF(buffer, filename) {
  try {
    console.log(`📄 Extracting text from PDF: ${filename}`);
    
    const pdf = require('pdf-parse');
    const data = await pdf(buffer);
    
    const text = data.text.trim();
    
    if (text.length < 50) {
      throw new Error('PDF appears to be empty or contains only images');
    }
    
    console.log(`✅ Extracted ${text.length} characters from PDF`);
    
    return {
      title: filename.replace(/\.pdf$/i, ''),
      content: text,
      source: 'file',
      fileName: filename
    };
    
  } catch (error) {
    console.error('PDF error:', error.message);
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}

/**
 * Extract text from DOCX buffer
 */
async function extractFromDocx(buffer, filename) {
  try {
    console.log(`📄 Extracting text from DOCX: ${filename}`);
    
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    
    if (text.length < 50) {
      throw new Error('Document appears to be empty');
    }
    
    console.log(`✅ Extracted ${text.length} characters from DOCX`);
    
    return {
      title: filename.replace(/\.docx?$/i, ''),
      content: text,
      source: 'file',
      fileName: filename
    };
    
  } catch (error) {
    throw new Error(`Failed to extract document content: ${error.message}`);
  }
}

/**
 * Extract text from plain text file
 */
function extractFromText(buffer, filename) {
  try {
    console.log(`📄 Reading text file: ${filename}`);
    
    const text = buffer.toString('utf-8').trim();
    
    if (text.length < 50) {
      throw new Error('Text file appears to be empty');
    }
    
    console.log(`✅ Read ${text.length} characters from text file`);
    
    return {
      title: filename.replace(/\.txt$/i, ''),
      content: text,
      source: 'file',
      fileName: filename
    };
    
  } catch (error) {
    throw new Error(`Failed to read text file: ${error.message}`);
  }
}

/**
 * Validate URL format
 */
function isValidURL(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { 
  extractFromURL, 
  extractFromPDF, 
  extractFromDocx,
  extractFromText,
  isValidURL
};