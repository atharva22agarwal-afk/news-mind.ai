const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const firestore = require('../services/firestoreService');
const aiService = require('../services/aiService');
let io = null;

// Set io from server.js
router.setIO = (socketIO) => { io = socketIO; };

/**
 * POST /api/debate/create
 * Create a new debate room
 */
router.post('/create', async (req, res) => {
  try {
    const { summaryId, userId = 'guest', userName = 'Anonymous' } = req.body;

    if (!summaryId) {
      return res.status(400).json({
        success: false,
        message: 'Summary ID is required'
      });
    }

    // Verify summary exists in Firestore
    const summary = await firestore.getById('summaries', summaryId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found'
      });
    }

    // Generate unique room ID
    const roomId = uuidv4();

    // Create debate room in Firestore
    const debateData = {
      summaryId,
      roomId,
      topic: summary.title,
      description: `Debate about: ${summary.title}`,
      createdBy: userId,
      status: 'active',
      isActive: true,
      maxParticipants: 10,
      participants: [userId],
      messages: [{
        userId: 'system',
        userName: 'System',
        content: `Debate room created for "${summary.title}". Share the room ID to invite others!`,
        timestamp: new Date(),
        side: 'neutral'
      }],
      arguments: [],
      lastActivity: new Date(),
      createdAt: new Date()
    };

    const debateDoc = await firestore.create('debates', debateData);

    console.log(`✅ Debate room created in Firestore: ${roomId}`);

    res.json({
      success: true,
      data: {
        id: debateDoc.id,
        roomId,
        topic: summary.title,
        createdAt: debateData.createdAt
      }
    });

  } catch (error) {
    console.error('Create debate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create debate room'
    });
  }
});

/**
 * POST /api/debate/:id/argue
 */
router.post('/:id/argue', async (req, res) => {
  try {
    const { content, side, userId = 'guest', userName = 'Anonymous' } = req.body;
    const debateId = req.params.id;

    const debate = await firestore.getById('debates', debateId);

    if (!debate) {
      return res.status(404).json({ error: 'Debate not found' });
    }

    if (debate.status !== 'active') {
      return res.status(400).json({ error: 'Debate is closed' });
    }

    if (!['for', 'against'].includes(side)) {
      return res.status(400).json({ error: 'Side must be for or against' });
    }

    if (!content || content.length < 20) {
      return res.status(400).json({ error: 'Argument too short. Make your case!' });
    }

    const newArgument = {
      id: uuidv4(),
      userId,
      content,
      side,
      aiIsAnalyzed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedArguments = [...(debate.arguments || []), newArgument];
    await firestore.update('debates', debateId, {
      arguments: updatedArguments,
      lastActivity: new Date()
    });

    res.json({
      success: true,
      argument: newArgument,
      message: 'Argument posted! AI analysis incoming...'
    });

    // Run AI analysis in background
    analyzeArgumentAsync(debateId, newArgument, content, side);

  } catch (err) {
    console.error('Argue error:', err);
    res.status(500).json({ error: err.message });
  }
});

async function analyzeArgumentAsync(debateId, argument, content, side) {
  try {
    // Get fresh debate data
    const debate = await firestore.getById('debates', debateId);
    if (!debate) return;

    const analysis = await aiService.judgeArgument(content, debate.topic, side);

    const currentArgs = [...(debate.arguments || [])];
    const argIndex = currentArgs.findIndex(a => a.id === argument.id);

    if (argIndex !== -1) {
      currentArgs[argIndex] = {
        ...currentArgs[argIndex],
        aiStrengthScore: analysis.strengthScore,
        aiLogicalFallacies: analysis.strongPoints || [],
        aiCounterArguments: analysis.weakPoints || [],
        aiVerdict: analysis.verdict,
        evidenceQuality: analysis.evidenceQuality,
        emotionPercent: analysis.emotionPercent,
        logicPercent: analysis.logicPercent,
        aiIsAnalyzed: true,
        updatedAt: new Date()
      };

      await firestore.update('debates', debateId, { arguments: currentArgs });
    }

    if (io) {
      io.to(`debate:${debate.id}`).emit('argument-analyzed', {
        argumentId: argument.id,
        analysis,
        debateId: debate.id
      });
    }

    // Every 5 arguments, moderate
    if (currentArgs.length % 5 === 0) {
      const messagesForModeration = currentArgs.map(a => ({
        sender: a.side,
        content: a.content
      }));

      const moderation = await aiService.moderateDebate(debate.topic, messagesForModeration);

      await firestore.update('debates', debateId, {
        aiForStrength: moderation.forStrength || 50,
        aiAgainstStrength: moderation.againstStrength || 50,
        aiDominantThemes: moderation.dominantThemes || [],
        aiLastUpdated: new Date()
      });

      if (io) {
        io.to(`debate:${debate.id}`).emit('debate-moderated', {
          debateId: debate.id,
          moderation
        });
      }
    }

  } catch (err) {
    console.error('Background AI analysis failed:', err.message);
  }
}

/**
 * POST /api/debate/join
 */
router.post('/join', async (req, res) => {
  try {
    const { roomId, userId = 'guest', userName = 'Anonymous' } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    const debate = await firestore.findOne('debates', 'roomId', roomId);

    if (!debate || !debate.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found or inactive'
      });
    }

    const alreadyJoined = debate.participants.includes(userId);

    if (!alreadyJoined) {
      if (debate.participants.length >= (debate.maxParticipants || 10)) {
        return res.status(400).json({
          success: false,
          message: 'Debate room is full'
        });
      }

      const participants = [...debate.participants, userId];
      const messages = [...(debate.messages || []), {
        userId: 'system',
        userName: 'System',
        content: `${userName} joined the debate`,
        timestamp: new Date(),
        side: 'neutral'
      }];

      await firestore.update('debates', debate.id, {
        participants,
        messages,
        lastActivity: new Date()
      });
      
      debate.participants = participants;
      debate.messages = messages;
    }

    res.json({
      success: true,
      data: debate
    });

  } catch (error) {
    console.error('Join debate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join debate room'
    });
  }
});

/**
 * POST /api/debate/message
 */
router.post('/message', async (req, res) => {
  try {
    const {
      roomId,
      message,
      userId = 'guest',
      userName = 'Anonymous',
      requestAIResponse = false
    } = req.body;

    if (!roomId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Room ID and message are required'
      });
    }

    const debate = await firestore.findOne('debates', 'roomId', roomId);

    if (!debate || !debate.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found'
      });
    }

    const userMsg = {
      userId,
      userName,
      content: message,
      timestamp: new Date(),
      side: 'neutral'
    };

    const updatedMessages = [...(debate.messages || []), userMsg];

    await firestore.update('debates', debate.id, {
      messages: updatedMessages,
      lastActivity: new Date()
    });

    let aiResponse = null;

    if (requestAIResponse) {
      try {
        const aiService = require('../services/aiService');
        const aiMsgContent = await aiService.generateDebateResponse(
          debate.topic,
          message,
          debate.messages
        );

        aiResponse = {
          userId: 'ai',
          userName: 'AI Moderator',
          content: aiMsgContent,
          timestamp: new Date(),
          side: 'neutral'
        };

        await firestore.update('debates', debate.id, {
          messages: [...updatedMessages, aiResponse],
          lastActivity: new Date()
        });

      } catch (aiError) {
        console.error('AI response error:', aiError);
      }
    }

    res.json({
      success: true,
      data: {
        userMessage: userMsg,
        aiResponse
      }
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

router.get('/:roomId', async (req, res) => {
  try {
    const debate = await firestore.findOne('debates', 'roomId', req.params.roomId);

    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found'
      });
    }

    res.json({
      success: true,
      data: debate
    });

  } catch (error) {
    console.error('Get debate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve debate'
    });
  }
});

router.delete('/:roomId', async (req, res) => {
  try {
    const { userId } = req.body;
    const debate = await firestore.findOne('debates', 'roomId', req.params.roomId);

    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found'
      });
    }

    if (debate.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can close this debate'
      });
    }

    await firestore.update('debates', debate.id, {
      isActive: false,
      status: 'closed'
    });

    res.json({
      success: true,
      message: 'Debate room closed'
    });

  } catch (error) {
    console.error('Close debate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close debate'
    });
  }
});
/**
 * GET /api/debate/:id/analysis
 * Generates a comprehensive AI analysis of the current debate state
 */
router.get('/:id/analysis', async (req, res) => {
  try {
    const debate = await firestore.getById('debates', req.params.id);
    if (!debate) {
      return res.status(404).json({ success: false, message: 'Debate not found' });
    }

    // Only analyze if there are actually some arguments
    if (!debate.arguments || debate.arguments.length < 2) {
      return res.json({
        success: true,
        data: {
          status: 'insufficient_data',
          message: 'Need more participation to generate a forensic analysis.'
        }
      });
    }

    console.log(`📊 Generating deep analysis for debate: ${req.params.id}`);
    const analysis = await aiService.generateDebateAnalysis(debate.topic, debate.arguments);

    res.json({
      success: true,
      data: analysis
    });

  } catch (error) {
    console.error('Debate Analysis Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate analysis' });
  }
});

module.exports = router;