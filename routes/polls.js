const express = require('express');
const router = express.Router();
const firestore = require('../services/firestoreService');

/**
 * POST /api/polls/create
 * Create a new poll in Firestore
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

    const pollData = {
      question,
      optionA,
      optionB,
      summaryId: summaryId || null,
      userId,
      votesA: 0,
      votesB: 0,
      voters: [],
      status: 'active',
      createdAt: new Date()
    };

    const pollDoc = await firestore.create('polls', pollData);

    console.log(`✅ Poll created in Firestore: ${pollDoc.id}`);

    res.json({
      success: true,
      data: { id: pollDoc.id, ...pollData }
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

    const poll = await firestore.getById('polls', pollId);

    if (!poll) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    const voters = poll.voters || [];
    if (voters.includes(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Already voted'
      });
    }

    const updateData = {
      voters: [...voters, userId]
    };

    if (option === 'A') {
      updateData.votesA = (poll.votesA || 0) + 1;
    } else if (option === 'B') {
      updateData.votesB = (poll.votesB || 0) + 1;
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid option. Use A or B'
      });
    }

    await firestore.update('polls', pollId, updateData);

    const totalVotes = updateData.votesA || poll.votesA + (updateData.votesB || poll.votesB);
    const finalVotesA = updateData.votesA || poll.votesA;
    const finalVotesB = updateData.votesB || poll.votesB;
    const finalTotal = finalVotesA + finalVotesB;

    const milestones = [10, 50, 100, 500];
    if (milestones.includes(finalTotal)) {
      generatePollInsight(pollId, { ...poll, ...updateData }).catch(console.error);
    }

    res.json({
      success: true,
      data: {
        votesA: finalVotesA,
        votesB: finalVotesB,
        total: finalTotal,
        optionAPercentage: finalTotal > 0 ? ((finalVotesA / finalTotal) * 100).toFixed(1) : 0,
        optionBPercentage: finalTotal > 0 ? ((finalVotesB / finalTotal) * 100).toFixed(1) : 0,
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

async function generatePollInsight(pollId, poll) {
  try {
    const { researchChat } = require('../services/aiService');

    const results = `"${poll.optionA}": ${poll.votesA} votes, "${poll.optionB}": ${poll.votesB} votes`;
    const total = poll.votesA + poll.votesB;

    const prompt = `Poll: "${poll.question}"\nResults: ${results}\nTotal votes: ${total}\n\nWhat does this voting pattern suggest about public opinion? Keep it under 3 sentences.`;

    const response = await researchChat(prompt, []);

    await firestore.update('polls', pollId, {
      aiInsight: response.reply,
      aiInsightGeneratedAt: new Date()
    });

    console.log(`✅ AI insight generated for poll ${pollId}`);
  } catch (error) {
    console.error('AI insight error:', error.message);
  }
}

router.get('/:id', async (req, res) => {
  try {
    const poll = await firestore.getById('polls', req.params.id);

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

router.get('/', async (req, res) => {
  try {
    const polls = await firestore.list('polls', [], 100, 'createdAt', 'desc');

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
