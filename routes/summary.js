const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const NodeCache = require('node-cache');
const admin = require('firebase-admin');
const firestore = require('../services/firestoreService');
const aiService = require('../services/aiService');
const { searchGoogle } = require('../services/webSearch');
const {
  extractFromURL,
  extractFromPDF,
  extractFromDocx,
  extractFromText,
  isValidURL
} = require('../services/contentExtractor');

// Initialize cache with 1 hour TTL (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });

// Constants for validation
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_WORD_COUNT = 50000;
const CACHE_TTL_SECONDS = 3600;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE },
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

    // Generate deep analysis - returns structured object
    const analysis = await aiService.deepSummarize(extracted.content, url);

    // Prepare data for database
    const summaryData = {
      userId,
      title: analysis.headline || 'Intelligence Report',
      headline: analysis.headline || 'Summary Analysis',
      tldr: analysis.tldr || analysis.summary || 'Summary unavailable.',
      originalContent: extracted.content.substring(0, MAX_WORD_COUNT * 10), // Limit storage
      summary: analysis.summary || analysis.tldr || 'Summary unavailable.',
      keyPoints: analysis.keyFacts || analysis.keyPoints || [],
      sentiment: analysis.sentiment || 'Objective',
      biasAnalysis: {
        score: analysis.biasScore || 0,
        label: analysis.biasLabel || 'Neutral',
        warning: analysis.missingContext || '',
        flags: analysis.credibilityFlags || []
      },
      depth,
      source: 'url',
      sourceUrl: url,
      wordCount: extracted.content.split(/\s+/).length,
      readingTime: Math.ceil(extracted.content.split(/\s+/).length / 200),
      viewCount: 0,
      isPublic: false
    };

    // Save to Firestore
    const summaryDoc = await firestore.create('summaries', summaryData);

    console.log(`✅ Summary created in Firestore: ${summaryDoc.id}`);

    const responseData = {
      ...summaryData,
      id: summaryDoc.id
    };

    // 2. SAVE TO CACHE
    cache.set(cacheKey, responseData);

    res.json({
      success: true,
      data: responseData
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
    const result = await aiService.deepSummarize(extracted.content, req.file.originalname);

    // Prepare Firestore data
    const summaryData = {
      userId,
      title: result.headline || extracted.title,
      originalContent: extracted.content.substring(0, MAX_WORD_COUNT * 10),
      summary: result.tldr || result.summary,
      keyPoints: result.keyFacts || [],
      depth,
      source: 'file',
      fileName: req.file.originalname,
      wordCount: extracted.content.split(/\s+/).length,
      readingTime: Math.ceil(extracted.content.split(/\s+/).length / 200),
      viewCount: 0,
      isPublic: false
    };

    // Save to Firestore
    const summaryDoc = await firestore.create('summaries', summaryData);

    console.log(`✅ Summary created in Firestore: ${summaryDoc.id}`);

    res.json({
      success: true,
      data: {
        id: summaryDoc.id,
        ...summaryData
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
 * Summarize raw text content
 */
router.post('/text', async (req, res) => {
  try {
    const { text, depth = 'medium', userId = 'guest' } = req.body;

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

      const { searchGoogle, scrapeWebPage } = require('../services/webSearch');
      const searchData = await searchGoogle(text);

      if (searchData && searchData.results) {
        // Build rich context: snippets from all results + scraped content from top result
        finalText = `Comprehensive Intelligence Dossier on "${text}":\n\n`;
        
        // Add all search snippets with source attribution
        finalText += `=== SEARCH INTELLIGENCE (${searchData.results.length} sources) ===\n\n`;
        searchData.results.slice(0, 7).forEach((r, i) => {
          finalText += `[Source ${i + 1}: ${r.title}]\n${r.snippet}\n\n`;
        });

        // Try to scrape the top result for deep context
        try {
          const scrapedContent = await scrapeWebPage(searchData.results[0].link);
          if (scrapedContent && scrapedContent.length > 200) {
            finalText += `\n=== DEEP SOURCE CONTENT (from ${searchData.results[0].title}) ===\n\n`;
            finalText += scrapedContent.substring(0, 8000);
            console.log(`✅ Scraped ${scrapedContent.length} chars from top result for AI context`);
          }
        } catch (scrapeErr) {
          console.log(`⚠️ Scraping failed, using snippets only: ${scrapeErr.message}`);
        }

        sourceLink = searchData.results[0]?.link;
        sourceType = 'search';
      }
    }

    // Generate Deep Analysis
    const analysis = await aiService.deepSummarize(finalText, sourceLink || '');

    // Prepare Firestore data
    const summaryData = {
      userId,
      title: analysis.headline || 'Text Analysis Report',
      headline: analysis.headline || 'Text Analysis',
      tldr: analysis.tldr || analysis.summary || 'Text summary unavailable.',
      originalContent: finalText.substring(0, MAX_WORD_COUNT * 10),
      summary: analysis.summary || analysis.tldr || 'Text summary unavailable.',
      keyPoints: analysis.keyFacts || analysis.keyPoints || [],
      sentiment: analysis.sentiment || 'Objective',
      biasAnalysis: {
        score: analysis.biasScore || 0,
        label: analysis.biasLabel || 'Neutral',
        warning: analysis.missingContext || '',
        flags: analysis.credibilityFlags || []
      },
      depth,
      source: sourceType,
      sourceUrl: sourceLink,
      wordCount: finalText.split(/\s+/).length,
      readingTime: Math.ceil(finalText.split(/\s+/).length / 200),
      viewCount: 0,
      isPublic: false
    };

    // Save to Firestore
    const summaryDoc = await firestore.create('summaries', summaryData);

    res.json({
      success: true,
      data: {
        id: summaryDoc.id,
        ...summaryData
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
 * GET /api/summary/trending
 * Most viewed summaries
 */
router.get('/trending', async (req, res) => {
  try {
    const result = await firestore.list('summaries', [], 20, 'viewCount', 'desc');
    const summaries = result.documents;

    const formatted = summaries.map(s => ({
      id: s.id,
      headline: s.headline || s.title,
      tldr: s.tldr,
      sentiment: s.sentiment,
      biasWarning: s.biasAnalysis?.warning,
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

/**
 * POST /api/summary/deep
 * Deep AI analysis
 */
router.post('/deep', async (req, res) => {
  try {
    const { url, rawText, userId = 'guest' } = req.body;

    if (!url && !rawText) {
      return res.status(400).json({ error: 'Provide a URL or text content' });
    }

    let content = rawText;
    let sourceUrl = url;

    if (url) {
      try {
        const extracted = await extractFromURL(url);
        content = extracted.content;
      } catch (e) {
        return res.status(422).json({ error: 'Could not extract content from this URL.' });
      }
    }

    // Check recent Firestore records
    if (sourceUrl) {
      const recent = await firestore.findOne('summaries', 'sourceUrl', sourceUrl);
      if (recent && (new Date() - new Date(recent.createdAt) < 24 * 60 * 60 * 1000)) {
        return res.json({ success: true, summary: recent, fromCache: true });
      }
    }

    // Deep AI analysis
    const analysis = await aiService.deepSummarize(content, sourceUrl || '');

    // Prepare Data
    const summaryData = {
      userId,
      sourceUrl,
      title: analysis.headline || 'Deep Report',
      headline: analysis.headline || 'Deep Analysis',
      tldr: analysis.tldr || analysis.summary || 'Content generated successfully.',
      originalContent: content.substring(0, MAX_WORD_COUNT * 10),
      summary: analysis.summary || analysis.tldr || 'Content generated successfully.',
      keyPoints: analysis.keyFacts || analysis.keyPoints || [],
      sentiment: analysis.sentiment || 'Objective',
      biasAnalysis: {
        score: analysis.biasScore || 0,
        warning: analysis.missingContext || '',
        flags: analysis.credibilityFlags || []
      },
      wordCount: content.split(/\s+/).length,
      readingTime: Math.ceil(content.split(/\s+/).length / 200),
      source: url ? 'url' : 'text',
      viewCount: 0,
      isPublic: false
    };

    const summary = await firestore.create('summaries', summaryData);

    res.json({ success: true, summary: { id: summary.id, ...summaryData } });

  } catch (err) {
    console.error('Deep summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/summary/:id
 * Get summary by ID with atomic view count increment
 */
router.get('/:id', async (req, res) => {
  try {
    const summary = await firestore.getById('summaries', req.params.id);

    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found'
      });
    }

    // Increment view count atomically using Firestore's FieldValue.increment
    firestore.increment('summaries', req.params.id, 'viewCount', 1).catch(console.error);

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

module.exports = router;