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
      votesB: 0,
      voters: []
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
 * Vote on a poll with AI insight generation
 */
router.post('/vote', async (req, res) => {
  try {
    const { pollId, option, userId = 'guest' } = req.body;
    
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
    
    // Check if user already voted
    const voters = poll.voters || [];
    if (voters.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already voted'
      });
    }
    
    // Record vote
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
    
    // Add voter to list
    poll.voters = [...voters, userId];
    await poll.save();
    
    const totalVotes = poll.votesA + poll.votesB;
    
    // Generate AI insight when poll hits milestones (10, 50, 100, 500 votes)
    const milestones = [10, 50, 100, 500];
    if (milestones.includes(totalVotes)) {
      // Run async - don't block the response
      generatePollInsight(poll).catch(console.error);
    }
    
    res.json({
      success: true,
      data: {
        votesA: poll.votesA,
        votesB: poll.votesB,
        total: totalVotes,
        optionAPercentage: ((poll.votesA / totalVotes) * 100).toFixed(1),
        optionBPercentage: ((poll.votesB / totalVotes) * 100).toFixed(1),
        aiInsight: poll.aiInsight
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
 * Generate AI insight for poll at milestones
 */
async function generatePollInsight(poll) {
  try {
    const { researchChat } = require('../services/aiService');
    
    const results = `"${poll.optionA}": ${poll.votesA} votes, "${poll.optionB}": ${poll.votesB} votes`;
    const total = poll.votesA + poll.votesB;
    
    const prompt = `Poll: "${poll.question}"\nResults: ${results}\nTotal votes: ${total}\n\nWhat does this voting pattern suggest about public opinion? Keep it under 3 sentences.`;
    
    const response = await researchChat(prompt, []);
    
    poll.aiInsight = response.reply;
    poll.aiInsightGeneratedAt = new Date();
    await poll.save();
    
    console.log(`✅ AI insight generated for poll ${poll.id}`);
  } catch (error) {
    console.error('AI insight error:', error.message);
  }
}

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
