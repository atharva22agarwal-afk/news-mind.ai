const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const NodeCache = require('node-cache');
const Summary = require('../models/Summary');
const { deepSummarize } = require('../services/aiService');
const aiService = require('../services/aiService');
const { searchGoogle, scrapeWebPage } = require('../services/webSearch');
const { 
  extractFromURL, 
  extractFromPDF, 
  extractFromDocx,
  extractFromText,
  isValidURL 
} = require('../services/contentExtractor');

// Initialize cache with 1 hour TTL (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed'));
    }
  }
});

/**
 * POST /api/summary/url
 * Summarize content from URL
 */
router.post('/url', async (req, res) => {
  try {
    const { url, depth = 'medium', userId = 'guest' } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL is required' 
      });
    }
    
    if (!isValidURL(url)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid URL format' 
      });
    }
    
    // Create cache key based on URL and depth
    const cacheKey = `summary_${url}_${depth}`;
    
    // 1. CHECK CACHE (Scalability Optimization)
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log("⚡ Serving from Cache (No AI cost)");
      return res.json({ 
        success: true, 
        data: cachedData,
        cached: true
      });
    }
    
    console.log(`🔍 Processing URL: ${url}`);
    
    // Extract content from URL
    const extracted = await extractFromURL(url);
    
    // Generate summary - returns an object with summary, keyPoints, etc.
    const result = await aiService.summarizeText(extracted.content, depth);
    
    // Generate title if not available
    const title = extracted.title || result.title || aiService.generateTitle(extracted.content);
    
    // Prepare response data
    const responseData = {
      title,
      summary: result.summary,
      keyPoints: result.keyPoints,
      wordCount: result.wordCount,
      readingTime: result.readingTime,
      depth,
      source: 'url',
      sourceUrl: url
    };
    
    // 2. SAVE TO CACHE
    cache.set(cacheKey, responseData);
    console.log(`💾 Cached summary for: ${url}`);
    
    // Save to database
    const summaryDoc = await Summary.create({
      userId,
      title,
      originalContent: extracted.content,
      summary: result.summary,
      keyPoints: result.keyPoints,
      depth,
      source: 'url',
      sourceUrl: url,
      wordCount: result.wordCount,
      readingTime: result.readingTime
    });
    
    console.log(`✅ Summary created: ${summaryDoc.id}`);
    
    res.json({
      success: true,
      data: {
        id: summaryDoc.id,
        ...responseData,
        createdAt: summaryDoc.createdAt
      }
    });
    
  } catch (error) {
    console.error('URL summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process URL' 
    });
  }
});

/**
 * POST /api/summary/file
 * Summarize content from uploaded file
 */
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    const { depth = 'medium', userId = 'guest' } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }
    
    console.log(`📝 Processing file: ${req.file.originalname}`);
    
    let extracted;
    const ext = path.extname(req.file.originalname).toLowerCase();
    
    // Extract based on file type
    if (ext === '.pdf') {
      extracted = await extractFromPDF(req.file.buffer, req.file.originalname);
    } else if (ext === '.docx' || ext === '.doc') {
      extracted = await extractFromDocx(req.file.buffer, req.file.originalname);
    } else if (ext === '.txt') {
      extracted = extractFromText(req.file.buffer, req.file.originalname);
    } else {
      return res.status(400).json({ 
        success: false, 
        message: 'Unsupported file type' 
      });
    }
    
    // Generate summary - returns an object
    const result = await aiService.summarizeText(extracted.content, depth);
    
    // Save to database
    const summaryDoc = await Summary.create({
      userId,
      title: extracted.title,
      originalContent: extracted.content,
      summary: result.summary,
      keyPoints: result.keyPoints,
      depth,
      source: 'file',
      fileName: req.file.originalname,
      wordCount: result.wordCount,
      readingTime: result.readingTime
    });
    
    console.log(`✅ Summary created: ${summaryDoc.id}`);
    
    res.json({
      success: true,
      data: {
        id: summaryDoc.id,
        title: extracted.title,
        summary: result.summary,
        keyPoints: result.keyPoints,
        wordCount: result.wordCount,
        readingTime: result.readingTime,
        depth,
        source: 'file',
        fileName: req.file.originalname,
        createdAt: summaryDoc.createdAt
      }
    });
    
  } catch (error) {
    console.error('File summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process file' 
    });
  }
});

/**
 * POST /api/summary/text
 * Summarize raw text content - SMART: If short, auto-searches web!
 */
router.post('/text', async (req, res) => {
  try {
    const { text, depth = 'medium', userId = 'guest', title } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Text is required' 
      });
    }
    
    console.log(`📝 Processing text input (${text.length} chars)`);
    
    // SMART SEARCH: If text is short (< 50 chars) and not a URL, treat as SEARCH TOPIC
    let finalText = text;
    let sourceLink = null;
    let sourceType = 'text';
    
    if (text.length < 50 && !text.includes('http') && !text.includes('www.')) {
      console.log(`🔍 Detected short topic input. Searching web for: ${text}`);
      
      const searchData = await searchGoogle(text);
      
      if (searchData && searchData.results) {
        // Combine search results into text
        finalText = `Latest news on "${text}":\n\n`;
        searchData.results.forEach((r, i) => {
          finalText += `${i + 1}. ${r.title}: ${r.snippet}\n`;
        });
        sourceLink = searchData.results[0]?.link;
        sourceType = 'search';
        console.log(`✅ Found ${searchData.results.length} search results`);
      }
    }
    
    // Generate summary - returns an object
    const result = await aiService.summarizeText(finalText, depth);
    
    // Generate title if not provided
    const finalTitle = title || result.title || aiService.generateTitle(text);
    
    // Save to database
    const summaryDoc = await Summary.create({
      userId,
      title: finalTitle,
      originalContent: finalText,
      summary: result.summary,
      keyPoints: result.keyPoints,
      depth,
      source: sourceType,
      sourceUrl: sourceLink,
      wordCount: result.wordCount,
      readingTime: result.readingTime
    });
    
    console.log(`✅ Summary created: ${summaryDoc.id}`);
    
    res.json({
      success: true,
      data: {
        id: summaryDoc.id,
        title: finalTitle,
        summary: result.summary,
        keyPoints: result.keyPoints,
        wordCount: result.wordCount,
        readingTime: result.readingTime,
        depth,
        source: sourceType,
        sourceUrl: sourceLink,
        createdAt: summaryDoc.createdAt
      }
    });
    
  } catch (error) {
    console.error('Text summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process text' 
    });
  }
});

/**
 * GET /api/summary/:id
 * Get a specific summary by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const summary = await Summary.findByPk(req.params.id);
    
    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        message: 'Summary not found' 
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
    
  } catch (error) {
    console.error('Get summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve summary' 
    });
  }
});

/**
 * POST /api/summary/deep
 * Deep AI analysis with structured output
 */
router.post('/deep', async (req, res) => {
  try {
    const { url, rawText, userId = 'guest' } = req.body;

    if (!url && !rawText) {
      return res.status(400).json({ error: 'Provide a URL or text content' });
    }

    let content = rawText;
    let sourceUrl = url;

    // Extract content from URL if provided
    if (url) {
      try {
        const extracted = await extractFromURL(url);
        content = extracted.content;
      } catch (e) {
        return res.status(422).json({ error: 'Could not extract content from this URL. Try pasting the text directly.' });
      }
    }

    // Check if this URL was already summarized recently (24hr cache)
    if (sourceUrl) {
      const recent = await Summary.findOne({
        where: {
          sourceUrl,
          createdAt: {
            [require('sequelize').Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      });

      if (recent) {
        return res.json({ success: true, summary: recent, fromCache: true });
      }
    }

    // Deep AI analysis
    const analysis = await deepSummarize(content, sourceUrl);

    // Save to DB with full structured data
    const summary = await Summary.create({
      userId,
      sourceUrl,
      title: analysis.headline,
      headline: analysis.headline,
      tldr: analysis.tldr,
      originalContent: content,
      summary: analysis.tldr,
      keyPoints: analysis.keyFacts || [],
      sentiment: analysis.sentiment,
      biasWarning: analysis.missingContext,
      biasScore: analysis.biasScore,
      credibilityFlags: analysis.credibilityFlags || [],
      readTime: Math.ceil(content.split(/\s+/).length / 200),
      source: url ? 'url' : 'text'
    });

    res.json({ success: true, summary });

  } catch (err) {
    console.error('Deep summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/summary/trending
 * Most viewed summaries with bias flags
 */
router.get('/trending', async (req, res) => {
  try {
    const summaries = await Summary.findAll({
      where: { isPublic: true },
      order: [['viewCount', 'DESC'], ['createdAt', 'DESC']],
      limit: 20
    });

    const formatted = summaries.map(s => ({
      id: s.id,
      headline: s.headline || s.title,
      tldr: s.tldr,
      sentiment: s.sentiment,
      biasWarning: s.biasWarning,
      sourceUrl: s.sourceUrl,
      createdAt: s.createdAt,
      viewCount: s.viewCount
    }));

    res.json({ success: true, summaries: formatted });
  } catch (err) {
    console.error('Trending error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;