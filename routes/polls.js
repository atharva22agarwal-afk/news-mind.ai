const express = require('express');
const router = express.Router();
const Poll = require('../models/Poll');

/**
 * POST /api/polls/create
 * Create a new poll
 */
router.post('/create', async (req, res) => {
  try {
    const { question, optionA, optionB, summaryId, userId = 'guest' } = req.body;
    
    if (!question || !optionA || !optionB) {
      return res.status(400).json({
        success: false,
        message: 'Question and both options are required'
      });
    }
    
    const poll = await Poll.create({
      question,
      optionA,
      optionB,
      summaryId: summaryId || null,
      userId,
      votesA: 0,
      votesB: 0
    });
    
    console.log(`✅ Poll created: ${poll.id}`);
    
    res.json({
      success: true,
      data: poll
    });
    
  } catch (error) {
    console.error('Create poll error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create poll'
    });
  }
});

/**
 * POST /api/polls/vote
 * Vote on a poll
 */
router.post('/vote', async (req, res) => {
  try {
    const { pollId, option } = req.body;
    
    if (!pollId || !option) {
      return res.status(400).json({
        success: false,
        message: 'Poll ID and option are required'
      });
    }
    
    const poll = await Poll.findByPk(pollId);
    
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }
    
    if (option === 'A') {
      poll.votesA += 1;
    } else if (option === 'B') {
      poll.votesB += 1;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid option. Use A or B'
      });
    }
    
    await poll.save();
    
    console.log(`✅ Vote recorded for poll ${pollId}: ${option}`);
    
    res.json({
      success: true,
      data: {
        votesA: poll.votesA,
        votesB: poll.votesB,
        total: poll.votesA + poll.votesB
      }
    });
    
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record vote'
    });
  }
});

/**
 * GET /api/polls/:id
 * Get poll details
 */
router.get('/:id', async (req, res) => {
  try {
    const poll = await Poll.findByPk(req.params.id);
    
    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }
    
    res.json({
      success: true,
      data: poll
    });
    
  } catch (error) {
    console.error('Get poll error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get poll'
    });
  }
});

/**
 * GET /api/polls
 * Get all polls
 */
router.get('/', async (req, res) => {
  try {
    const polls = await Poll.findAll({
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      success: true,
      data: polls
    });
    
  } catch (error) {
    console.error('Get polls error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get polls'
    });
  }
});

module.exports = router;
