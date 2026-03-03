const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Summary = require('../models/Summary');
const aiService = require('../services/aiService');
const { 
  extractFromURL, 
  extractFromPDF, 
  extractFromDocx,
  extractFromText,
  isValidURL 
} = require('../services/contentExtractor');

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
    
    console.log(`🔍 Processing URL: ${url}`);
    
    // Extract content from URL
    const extracted = await extractFromURL(url);
    
    // Generate summary - returns an object with summary, keyPoints, etc.
    const result = await aiService.summarizeText(extracted.content, depth);
    
    // Generate title if not available
    const title = extracted.title || result.title || aiService.generateTitle(extracted.content);
    
    // Save to database
    const summaryDoc = new Summary({
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
    
    await summaryDoc.save();
    
    console.log(`✅ Summary created: ${summaryDoc._id}`);
    
    res.json({
      success: true,
      data: {
        id: summaryDoc._id,
        title,
        summary: result.summary,
        keyPoints: result.keyPoints,
        wordCount: result.wordCount,
        readingTime: result.readingTime,
        depth,
        source: 'url',
        sourceUrl: url,
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
    const summaryDoc = new Summary({
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
    
    await summaryDoc.save();
    
    console.log(`✅ Summary created: ${summaryDoc._id}`);
    
    res.json({
      success: true,
      data: {
        id: summaryDoc._id,
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
 * Summarize raw text content
 */
router.post('/text', async (req, res) => {
  try {
    const { text, depth = 'medium', userId = 'guest', title } = req.body;
    
    if (!text || text.trim().length < 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Text must be at least 100 characters long' 
      });
    }
    
    console.log(`📝 Processing text input (${text.length} chars)`);
    
    // Generate summary - returns an object
    const result = await aiService.summarizeText(text, depth);
    
    // Generate title if not provided
    const finalTitle = title || result.title || aiService.generateTitle(text);
    
    // Save to database
    const summaryDoc = new Summary({
      userId,
      title: finalTitle,
      originalContent: text,
      summary: result.summary,
      keyPoints: result.keyPoints,
      depth,
      source: 'text',
      wordCount: result.wordCount,
      readingTime: result.readingTime
    });
    
    await summaryDoc.save();
    
    console.log(`✅ Summary created: ${summaryDoc._id}`);
    
    res.json({
      success: true,
      data: {
        id: summaryDoc._id,
        title: finalTitle,
        summary: result.summary,
        keyPoints: result.keyPoints,
        wordCount: result.wordCount,
        readingTime: result.readingTime,
        depth,
        source: 'text',
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
    const summary = await Summary.findById(req.params.id);
    
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

module.exports = router;