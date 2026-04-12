const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cors = require('cors');
const path = require('path');

// Set up environment — functions config is automatically loaded
// For secrets, use Firebase Functions secrets or .env in functions dir
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Ensure Firebase is initialized
require('../config/firebase');

const app = express();

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.includes('localhost') || origin.includes('127.0.0.1') ||
        origin.endsWith('.vercel.app') || origin.endsWith('.web.app') ||
        origin.endsWith('.firebaseapp.com')) {
      return callback(null, true);
    }
    callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// AI Service for comparison tool
const aiService = require('../services/aiService');

// Routes
app.use('/api/auth', require('../routes/auth'));
app.use('/api/summary', require('../routes/summary'));
const debateRouter = require('../routes/debate');
// No socket.io in Cloud Functions — setIO is a no-op (io defaults to null)
app.use('/api/debate', debateRouter);
app.use('/api/history', require('../routes/history'));
app.use('/api/polls', require('../routes/polls'));
app.use('/api/research', require('../routes/research'));
app.use('/api/chat', require('../routes/chat'));
app.use('/api/factcheck', require('../routes/factcheck'));
app.use('/api/feed', require('../routes/public_feed'));

// Article Comparison Route
app.post('/api/tools/compare', async (req, res) => {
  try {
    const { url1, url2 } = req.body;
    if (!url1 || !url2) {
      return res.status(400).json({ error: 'Please provide both URL A and URL B.' });
    }
    const analysisMarkdown = await aiService.compareArticles(url1, url2);
    res.json({ success: true, data: analysisMarkdown });
  } catch (error) {
    console.error('Comparison Error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze sources.' });
  }
});

// Health Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'success',
    message: 'NewsMind AI API is running on Firebase!',
    version: '2.0.0',
    database: 'Firebase Firestore',
    env: 'Firebase Cloud Functions'
  });
});

// 404 Handler for API
app.use('/api', (req, res) => {
  res.status(404).json({ status: 'error', message: 'API Endpoint not found' });
});

// Export as Firebase Function with increased timeout and memory
exports.api = onRequest({
  timeoutSeconds: 120,
  memory: '512MiB',
  region: 'us-central1'
}, app);
