const { body, param, query, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');

/**
 * Security & Input Validation Middleware
 * Prevents XSS, injection attacks, and malicious input
 */

/**
 * Sanitize HTML to prevent XSS
 * Allows only safe tags for formatting
 */
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return sanitizeHtml(obj, {
        allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
        allowedAttributes: {}
      });
    }
    if (typeof obj === 'object' && obj !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query params
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

/**
 * Validate URL format
 */
const validateURL = [
  body('url')
    .optional()
    .isURL({ protocols: ['http', 'https'], require_protocol: true })
    .withMessage('Invalid URL format. Must start with http:// or https://')
    .normalizeEmail({ gmail_remove_dots: false })
    .trim(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Validate text input (not too short, not too long)
 */
const validateText = [
  body('text')
    .optional()
    .isString()
    .withMessage('Text must be a string')
    .isLength({ min: 1, max: 50000 })
    .withMessage('Text must be between 1 and 50,000 characters')
    .trim(),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Validate debate argument
 */
const validateArgument = [
  body('content')
    .notEmpty()
    .withMessage('Argument content is required')
    .isLength({ min: 20, max: 5000 })
    .withMessage('Argument must be between 20 and 5000 characters'),
  
  body('side')
    .notEmpty()
    .withMessage('Side is required')
    .isIn(['for', 'against'])
    .withMessage('Side must be either "for" or "against"'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Validate debate room ID
 */
const validateDebateId = [
  param('id')
    .notEmpty()
    .withMessage('Debate ID is required')
    .isLength({ min: 36, max: 36 }) // UUID length
    .withMessage('Invalid debate ID format'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Validate file upload
 */
const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded'
    });
  }

  const allowedMimes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];

  if (!allowedMimes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed. Only PDF, DOC, DOCX, and TXT are accepted.'
    });
  }

  next();
};

/**
 * Validate user ID (prevent injection)
 */
const validateUserId = [
  body('userId')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid user ID format'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Validate pagination params
 */
const validatePagination = [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('skip')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Skip must be a non-negative integer'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Validate summary ID
 */
const validateSummaryId = [
  param('id')
    .notEmpty()
    .withMessage('Summary ID is required')
    .isLength({ min: 20, max: 50 })
    .withMessage('Invalid summary ID format'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(e => e.msg)
      });
    }
    next();
  }
];

/**
 * Request size limiter middleware
 * Prevents large payload attacks
 */
const requestSizeLimiter = (req, res, next) => {
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
};

/**
 * Content-Type validator
 * Ensures correct content type for JSON endpoints
 */
const validateContentType = (required = true) => (req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.headers['content-type'];
    
    if (!contentType) {
      if (required) {
        return res.status(400).json({
          success: false,
          error: 'Content-Type header required',
          message: 'Please set Content-Type: application/json'
        });
      }
    } else if (!contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Content-Type',
        message: 'Expected application/json'
      });
    }
  }

  next();
};

/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Content Security Policy (Expanded for Firebase, Render, Icons, and CDNs)
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://www.gstatic.com https://apis.google.com https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://unpkg.com https://www.gstatic.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://unpkg.com; img-src 'self' data: https:; connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com https://*.cloudfunctions.net https://news-mind-55135.web.app https://news-mind-55135.firebaseapp.com https://*.onrender.com wss://*.onrender.com");
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

module.exports = {
  sanitizeInput,
  validateURL,
  validateText,
  validateArgument,
  validateDebateId,
  validateFileUpload,
  validateUserId,
  validatePagination,
  validateSummaryId,
  requestSizeLimiter,
  validateContentType,
  securityHeaders
};
