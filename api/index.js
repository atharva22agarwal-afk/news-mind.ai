const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Ensure Firebase is initialized
require('../config/firebase');

const app = express();

// Error handling wrapper for initialization
let appError = null;

try {
  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

  // Serve static files from root
  const rootDir = path.join(__dirname, '..');
  app.use(express.static(rootDir));

  // Health Check / Status
  app.get('/api/status', async (req, res) => {
    try {
      console.log('Environment Check:', {
        VERCEL: process.env.VERCEL,
        NODE_ENV: process.env.NODE_ENV
      });

      res.json({
        status: 'success',
        message: 'NewsMind AI API is running!',
        version: '1.3.0',
        database: 'Firebase Firestore',
        env: process.env.VERCEL ? 'Vercel' : 'Local',
        endpoints: {
          summary: '/api/summary',
          debate: '/api/debate',
          history: '/api/history'
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error.message
      });
    }
  });

  // Root route serves landing page
  app.get('/', (req, res) => {
    res.sendFile(path.join(rootDir, 'index.html'));
  });

  // 404 Handler - redirect unknown API calls but keep others
  app.use('/api/*', (req, res) => {
    res.status(404).json({
      status: 'error',
      message: 'API Endpoint not found'
    });
  });

} catch (error) {
  console.error('Fatal Initialization Error:', error);
  appError = error;

  app.use((req, res) => {
    res.status(500).json({
      status: 'error',
      message: 'Server failed to initialize',
      error: error.message,
      hint: 'Check Vercel environment variables and Database connection.'
    });
  });
}

module.exports = app;
