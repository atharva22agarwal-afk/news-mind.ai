// routes/factcheck.js - BRAND NEW ROUTE
const express = require('express');
const router = express.Router();
const { factCheck } = require('../services/aiService');
const { Argument } = require('../models/Debate');

// Rate limiting storage (simple in-memory for now)
const rateLimitStore = new Map();

// Rate limit: 10 fact-checks per user per 15 minutes
function factCheckLimiter(req, res, next) {
  const userId = req.body.userId || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const max = 10;
  
  const userRequests = rateLimitStore.get(userId) || [];
  const recentRequests = userRequests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= max) {
    return res.status(429).json({ error: 'Too many fact-checks. Try again in 15 minutes.' });
  }
  
  recentRequests.push(now);
  rateLimitStore.set(userId, recentRequests);
  next();
}

// POST /api/factcheck
router.post('/', factCheckLimiter, async (req, res) => {
  try {
    const { claim, debateId, argumentId, userId = 'guest' } = req.body;

    if (!claim || claim.trim().length < 10) {
      return res.status(400).json({ error: 'Claim must be at least 10 characters' });
    }

    if (claim.length > 500) {
      return res.status(400).json({ error: 'Keep claim under 500 characters for best results' });
    }

    const result = await factCheck(claim.trim());

    // Optional: if this fact-check is linked to a debate argument, save it
    if (debateId && argumentId) {
      try {
        await Argument.update(
          {
            factCheckVerdict: result.verdict,
            factCheckConfidence: result.confidence,
            factCheckExplanation: result.explanation,
            factCheckCheckedAt: new Date()
          },
          { where: { id: argumentId, debateId } }
        );
      } catch (dbError) {
        console.log('Could not link fact-check to argument:', dbError.message);
      }
    }

    res.json({
      success: true,
      claim,
      ...result,
      checkedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Fact check error:', err);
    res.status(500).json({ error: 'Fact check failed. Try again.' });
  }
});

module.exports = router;
