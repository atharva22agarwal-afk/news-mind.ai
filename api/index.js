const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Error handling wrapper for sync errors
let appError = null;

try {
  // Check required environment variables
  if (!process.env.GEMINI_API_KEY) {
    console.warn('Warning: GEMINI_API_KEY not set');
  }

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Import models to register them with Sequelize
  require('../models/User');
  require('../models/Summary');
  require('../models/Debate');
  require('../models/Poll');

  // AI Service for comparison tool
  const aiService = require('../services/aiService');

  // Routes
  app.use('/api/summary', require('../routes/summary'));
  app.use('/api/debate', require('../routes/debate'));
  app.use('/api/history', require('../routes/history'));
  app.use('/api/polls', require('../routes/polls'));
  app.use('/api/research', require('../routes/research'));
  app.use('/api/chat', require('../routes/chat'));
  app.use('/api/auth', require('../routes/auth'));
  app.use('/api/factcheck', require('../routes/factcheck'));

  // Article Comparison Route
  app.post('/api/tools/compare', async (req, res) => {
    try {
      const { url1, url2 } = req.body;

      if (!url1 || !url2) {
        return res.status(400).json({ error: 'Please provide both URL A and URL B.' });
      }

      // Validate URLs
      const urlRegex = /^https?:\/\/.+/i;
      if (!urlRegex.test(url1) || !urlRegex.test(url2)) {
        return res.status(400).json({ error: 'Invalid URL format. Please provide valid URLs.' });
      }

      // Call the AI Service
      const analysisMarkdown = await aiService.compareArticles(url1, url2);

      res.json({
        success: true,
        data: analysisMarkdown
      });

    } catch (error) {
      console.error('Comparison Error:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze sources.' });
    }
  });

  // Health Check
  app.get('/', (req, res) => {
    res.json({
      status: 'success',
      message: 'News AI Summarizer API is running!',
      version: '1.0.0',
      database: 'SQLite',
      realtime: 'Serverless mode (Socket.io disabled)',
      endpoints: {
        summary: '/api/summary',
        debate: '/api/debate',
        history: '/api/history'
      }
    });
  });

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      status: 'error',
      message: 'Endpoint not found'
    });
  });

  // Error Handler
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      status: 'error',
      message: err.message || 'Internal server error'
    });
  });

} catch (error) {
  console.error('Fatal error during app initialization:', error);
  appError = error;

  // Return error for all routes if app failed to initialize
  app.use((req, res) => {
    res.status(500).json({
      status: 'error',
      message: 'Server initialization failed: ' + (appError?.message || 'Unknown error'),
      hint: 'Check if environment variables are set in Vercel dashboard'
    });
  });
}

module.exports = app;
