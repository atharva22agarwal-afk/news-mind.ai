const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/database');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const httpServer = http.createServer(app);

// Socket.io setup for real-time features
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5501', 'http://127.0.0.1:5501'],
    methods: ['GET', 'POST'],
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

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Set io on debate router
const debateRouter = require('./routes/debate');
debateRouter.setIO(io);

// Middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5501', 'http://127.0.0.1:5501'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (for audio files)
app.use('/uploads', express.static('uploads'));

// Import models (registers them with Mongoose)
require('./models/User');
require('./models/Summary');
require('./models/Debate');
require('./models/Poll');

// AI Service for comparison tool
const aiService = require('./services/aiService');

// Routes
app.use('/api/summary', require('./routes/summary'));
app.use('/api/debate', require('./routes/debate'));
app.use('/api/history', require('./routes/history'));
app.use('/api/polls', require('./routes/polls'));
app.use('/api/research', require('./routes/research'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/factcheck', require('./routes/factcheck'));

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
app.get('/', async (req, res) => {
  try {
    const dbState = require('mongoose').connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'success',
      message: 'News AI Summarizer API is running!',
      version: '1.0.0',
      database: 'MongoDB',
      dbStatus,
      realtime: 'Socket.io enabled',
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

// Start Server with MongoDB connection
const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log('✅ MongoDB Connected & Models Registered');

    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📱 Access from other devices: http://YOUR_IP:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/`);
      console.log(`🔌 Socket.io enabled for real-time features`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
