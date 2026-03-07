const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Error handling wrapper for initialization
let appError = null;

try {
  // Import database connection (Sequelize version)
  const { sequelize, connectDB } = require('../config/database');

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Connect/Sync to Database on first request (serverless optimization)
  let dbConnected = false;
  const ensureDB = async () => {
    if (!dbConnected) {
      await connectDB();
      // In serverless, we usually don't want to sync { alter: true } on every request
      // but ensure connection is established
      dbConnected = true;
    }
  };

  // Database middleware - ensures connection for all routes
  app.use(async (req, res, next) => {
    try {
      await ensureDB();
      next();
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Database connection failed',
        error: error.message
      });
    }
  });

  // Import models (Sequelize registration)
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
      const hasPg = !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);
      console.log('Environment Check:', {
        VERCEL: process.env.VERCEL,
        HAS_PG: hasPg,
        NODE_ENV: process.env.NODE_ENV
      });

      await ensureDB();

      res.json({
        status: 'success',
        message: 'NewsMind AI API is running!',
        version: '1.2.1',
        database: hasPg ? 'Postgres (Cloud)' : 'SQLite (Local/Ephemeral fallback)',
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
