const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
require('dotenv').config();

// Ensure Firebase is initialized
require('./config/firebase');

const app = express();
const httpServer = http.createServer(app);

// Socket.io setup for real-time features
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.includes('localhost') || origin.includes('127.0.0.1') ||
          origin.endsWith('.vercel.app') || origin.endsWith('.web.app') ||
          origin.endsWith('.firebaseapp.com') || origin.endsWith('.onrender.com')) {
        return callback(null, true);
      }
      callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a debate room
  socket.on('join-debate', (debateId) => {
    socket.join(`debate:${debateId}`);
    console.log(`Socket ${socket.id} joined debate:${debateId}`);
  });

  // Leave a debate room
  socket.on('leave-debate', (debateId) => {
    socket.leave(`debate:${debateId}`);
    console.log(`Socket ${socket.id} left debate:${debateId}`);
  });

  // Join a poll room
  socket.on('join-poll', (pollId) => {
    socket.join(`poll:${pollId}`);
  });

  // Leave a poll room
  socket.on('leave-poll', (pollId) => {
    socket.leave(`poll:${pollId}`);
  });

  // Global Feed - Post broadcasting
  socket.on('new-public-post', (postData) => {
    io.emit('public-post-broadcast', postData);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Set io on debate router
const debateRouter = require('./routes/debate');
debateRouter.setIO(io);

// Store for route mounting
app.set('debateRouter', debateRouter);

// ==================== SECURITY MIDDLEWARE ====================

// Helmet for security headers (XSS protection, clickjacking prevention, etc.)
app.use(helmet({
  contentSecurityPolicy: false, // Disable for now, configure based on your needs
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false
}));

// CORS with specific origins (NOT wildcard in production)
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5501',
  'http://127.0.0.1:5501',
  'http://localhost:5502',
  'http://127.0.0.1:5502',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com')) {
      callback(null, true);
    } else {
      console.warn(`🚫 Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Request size limiter (prevent large payload attacks)
app.use((req, res, next) => {
  const contentLength = parseInt(req.headers['content-length']);
  const maxContentLength = 10 * 1024 * 1024; // 10MB
  
  if (contentLength && contentLength > maxContentLength) {
    return res.status(413).json({
      success: false,
      error: 'Request payload too large',
      message: 'Maximum request size is 10MB'
    });
  }
  next();
});

// Input sanitization (prevent XSS)
const { sanitizeInput, securityHeaders } = require('./middleware/security');
app.use(sanitizeInput);
app.use(securityHeaders);

// Rate limiting middleware
const { generalLimiter, aiLimiter, uploadLimiter, authLimiter, chatLimiter, speedLimiter } = require('./middleware/rateLimiter');

// Apply general rate limiter and speed limiter to all routes
app.use(generalLimiter);
app.use(speedLimiter);

// Standard middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for audio files)
app.use('/uploads', express.static('uploads'));

// AI Service for comparison tool
const aiService = require('./services/aiService');

// Health monitoring
const { healthMonitor, healthMiddleware, healthCheckHandler, readinessHandler, livenessHandler, metricsHandler } = require('./services/healthMonitor');

// Apply health monitoring middleware
app.use(healthMiddleware);

// Make db and aiService available to health monitor
const { db } = require('./config/firebase');
app.locals.db = db;
app.locals.aiService = aiService;

// ==================== HEALTH CHECK ENDPOINTS ====================

// Comprehensive health check
app.get('/api/health', healthCheckHandler);

// Kubernetes readiness probe
app.get('/api/ready', readinessHandler);

// Kubernetes liveness probe
app.get('/api/live', livenessHandler);

// Prometheus-compatible metrics
app.get('/api/metrics', metricsHandler);

// ==================== ROUTES WITH RATE LIMITING ====================

// Auth routes - strict rate limiting (prevent brute force)
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Summary routes - AI rate limiting (expensive operations)
app.use('/api/summary', aiLimiter, require('./routes/summary'));

// Debate routes - chat rate limiting
app.use('/api/debate', chatLimiter, debateRouter);

// History routes - general access
app.use('/api/history', require('./routes/history'));

// Diagnostic Endpoint for Firebase Authentication
app.get('/api/debug-firebase', async (req, res) => {
    try {
        const admin = require('firebase-admin');
        const fs = require('fs');
        const path = require('path');
        const tempKeyPath = path.join(process.cwd(), '.temp-firebase-key.json');
        
        let fileExists = false;
        let fileStats = null;
        let fileContent = null;
        let fileKeys = [];
        
        if (fs.existsSync(tempKeyPath)) {
            fileExists = true;
            fileStats = fs.statSync(tempKeyPath);
            try {
                const rawContent = fs.readFileSync(tempKeyPath, 'utf8');
                const parsed = JSON.parse(rawContent);
                fileKeys = Object.keys(parsed);
                fileContent = {
                    project_id: parsed.project_id,
                    client_email: parsed.client_email,
                    private_key_length: parsed.private_key ? parsed.private_key.length : 0,
                    private_key_preview: parsed.private_key ? parsed.private_key.substring(0, 35) + '...' : null,
                    private_key_newlines: parsed.private_key ? (parsed.private_key.match(/\n/g) || []).length : 0,
                };
            } catch(e) {}
        }

        res.json({
            nodeVersion: process.version,
            envKeys: Object.keys(process.env).filter(k => k.includes('FIRE') || k.includes('GOOG') || k.includes('CLOUD')),
            fileExists,
            fileStats,
            fileContent,
            fileKeys,
            adminAppLength: admin.apps.length,
            initializeAppOptions: admin.apps.length > 0 ? admin.apps[0].options : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth Diagnostic Endpoint
app.get('/api/diag-auth', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const path = require('path');
        const scriptPath = path.join(process.cwd(), 'scripts', 'diagnose-auth.js');
        
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            res.json({
                stdout: stdout,
                stderr: stderr,
                error: error ? error.message : null
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Manual Auth Test
app.get('/api/manual-auth', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const path = require('path');
        const scriptPath = path.join(process.cwd(), 'scripts', 'test-manual-auth.js');
        
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
            res.json({ stdout, stderr, error: error ? error.message : null });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Polls routes
app.use('/api/polls', require('./routes/polls'));

// Research routes - AI intensive
app.use('/api/research', aiLimiter, require('./routes/research'));

// Chat routes - AI + chat limiting
app.use('/api/chat', aiLimiter, chatLimiter, require('./routes/chat'));

// Fact-check routes - AI intensive
app.use('/api/factcheck', aiLimiter, require('./routes/factcheck'));

// Public feed routes
app.use('/api/feed', require('./routes/public_feed'));

// Article Comparison Route - AI intensive
app.post('/api/tools/compare', aiLimiter, async (req, res) => {
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

// Health Check / API Status (Legacy endpoint - use /api/health for detailed)
app.get('/api/status', async (req, res) => {
  try {
    const health = await healthMonitor.getHealthStatus(db, aiService);
    
    res.json({
      status: 'success',
      message: 'NewsMind AI API is running!',
      version: '1.1.0',
      database: 'Firebase Firestore',
      dbStatus: health.database.connected ? 'connected' : 'disconnected',
      dbLatency: health.database.latency || 0,
      realtime: 'Socket.io enabled',
      uptime: health.uptime,
      performance: health.performance,
      memory: health.memory,
      aiServices: {
        groq: health.aiServices.groq,
        gemini: health.aiServices.gemini
      },
      endpoints: {
        summary: '/api/summary',
        debate: '/api/debate',
        history: '/api/history',
        health: '/api/health',
        metrics: '/api/metrics'
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

// Serve static frontend files
const path = require('path');
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Endpoint not found'
  });
});

// Principal Architect's High-Resilience Error Handler
app.use((err, req, res, next) => {
  console.error('SERVER_FAULT:', err.stack);

  // Handle Gemini/AI Rate Limits (429)
  if (err.message?.includes('429') || err.status === 429 || err.code === 'RESOURCE_EXHAUSTED') {
    return res.status(429).json({
      status: 'error',
      code: 'ENTROPY_LIMIT_REACHED',
      message: 'AI Model is currently saturated. Back-off triggered. Please retry in 60 seconds.',
      verdict: 'High demand on Semantic Gravity Engine.'
    });
  }

  // Handle Model Overload (500/503)
  if (err.message?.includes('500') || err.message?.includes('503') || err.code === 'INTERNAL') {
    return res.status(503).json({
      status: 'error',
      code: 'NEURAL_OVERLOAD',
      message: 'The AI service is experiencing high latency or internal faults.',
      verdict: 'Upstream Provider Latency'
    });
  }

  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    manifest: 'CORE_RUNTIME_EXCEPTION'
  });
});

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = () => {
  try {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.io enabled for real-time features`);
      console.log(`🌐 Application is live! (Firebase Backend)`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
