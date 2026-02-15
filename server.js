const express = require('express');
const cors = require('cors');
const sequelize = require('./config/database');
require('dotenv').config();

const app = express();

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

// Import models to register them with Sequelize
const User = require('./models/User');
const Summary = require('./models/Summary');
const Debate = require('./models/Debate');
const Poll = require('./models/Poll');

// Routes
app.use('/api/summary', require('./routes/summary'));
app.use('/api/debate', require('./routes/debate'));
app.use('/api/history', require('./routes/history'));
app.use('/api/polls', require('./routes/polls'));
app.use('/api/research', require('./routes/research'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/auth', require('./routes/auth'));

// Health Check
app.get('/', (req, res) => {
  res.json({ 
    status: 'success',
    message: 'News AI Summarizer API is running!',
    version: '1.0.0',
    database: 'SQLite',
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

// Start Server with SQLite sync
const PORT = process.env.PORT || 5000;

sequelize.sync({ force: false }).then(() => {
  console.log('✅ SQLite Database Connected & Synced');
  console.log('📊 Database file: newsmind.sqlite');
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Access from other devices: http://YOUR_IP:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/`);
  });
}).catch(err => {
  console.error('❌ Database Error:', err);
});
