const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting Configuration
 * Prevents API abuse, DDoS, and AI quota exhaustion
 * Uses in-memory store (for Firestore store, use rate-limit-firestore package)
 */

/**
 * General API Rate Limiter
 * Limits: 100 requests per 15 minutes per IP
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
    retryAfter: 900 // seconds
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?.uid || req.ip;
  },
  handler: (req, res) => {
    console.warn(`⚠️ Rate limit exceeded for ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Please slow down. AI resources are limited.',
      retryAfter: 900
    });
  }
});

/**
 * AI Endpoints Rate Limiter (STRICT)
 * Limits: 10 requests per minute per user (AI is expensive!)
 */
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute
  message: {
    success: false,
    error: 'AI rate limit exceeded',
    message: 'You\'re using AI features too quickly. Please wait a minute.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?.uid || req.ip;
  },
  skip: (req) => {
    // Skip for admin users (if you have admin logic)
    return req.user?.role === 'admin';
  }
});

/**
 * File Upload Rate Limiter
 * Limits: 5 uploads per minute (file processing is expensive)
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Upload limit exceeded',
    message: 'Maximum 5 file uploads per minute.',
    retryAfter: 60
  }
});

/**
 * Auth Rate Limiter (Very Strict)
 * Limits: 5 login attempts per 15 minutes (prevent brute force)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Account temporarily locked for security.',
    retryAfter: 900
  },
  skipSuccessfulRequests: true, // Only count failed attempts
  keyGenerator: (req) => {
    // Lock by IP and email combination
    return `${req.ip}:${req.body.email || 'unknown'}`;
  }
});

/**
 * Debate/Chat Rate Limiter
 * Limits: 30 messages per minute (prevent spam)
 */
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: 'Message limit exceeded',
    message: 'You\'re sending messages too quickly.',
    retryAfter: 60
  }
});

/**
 * Search/Text Input Rate Limiter
 * Limits: 20 searches per minute
 */
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Search limit exceeded',
    message: 'Too many searches. Please wait a moment.',
    retryAfter: 60
  }
});

/**
 * Slow Down - Progressive delay for suspicious activity
 * Adds increasing delay after 50 requests in 15 minutes
 */
const slowDown = require('express-slow-down');
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (hits) => hits * 100, // 100ms delay per hit, caps at 5 seconds
  maxDelayMs: 5000,
  keyGenerator: (req) => req.ip,
  skip: (req) => req.user?.role === 'admin'
});

module.exports = {
  generalLimiter,
  aiLimiter,
  uploadLimiter,
  authLimiter,
  chatLimiter,
  searchLimiter,
  speedLimiter
};
