const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Debate = require('../models/Debate');
const Summary = require('../models/Summary');
const { judgeArgument, moderateDebate } = require('../services/aiService');
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

    // Verify summary exists (Sequelize syntax)
    const summary = await Summary.findByPk(summaryId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        message: 'Summary not found'
      });
    }

    // Generate unique room ID
    const roomId = uuidv4();

    // Create debate room (Sequelize syntax)
    const debate = await Debate.create({
      summaryId,
      roomId,
      topic: summary.title,
      description: `Debate about: ${summary.title}`,
      createdBy: userId,
      participants: [userId], // Simple array of userIds
      messages: [{
        userId: 'system',
        userName: 'System',
        content: `Debate room created for "${summary.title}". Share the room ID to invite others!`,
        timestamp: new Date(),
        side: 'neutral'
      }]
    });

    console.log(`✅ Debate room created: ${roomId}`);

    res.json({
      success: true,
      data: {
        roomId,
        topic: summary.title,
        createdAt: debate.createdAt
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
 * Submit an argument with AI analysis
 */
router.post('/:id/argue', async (req, res) => {
  try {
    const { content, side, userId = 'guest', userName = 'Anonymous' } = req.body;
    const debateId = req.params.id;

    // Sequelize syntax
    const debate = await Debate.findByPk(debateId);

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

    // Add argument to JSON array (Sequelize requires manual update for JSON)
    const currentArguments = debate.arguments || [];
    const newArgument = {
      id: uuidv4(), // Give it an ID since it's in JSON now
      userId,
      content,
      side,
      aiIsAnalyzed: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const updatedArguments = [...currentArguments, newArgument];
    await debate.update({
      arguments: updatedArguments,
      lastActivity: new Date()
    });

    // Get the saved argument
    const savedArgument = newArgument;

    // Send response immediately - don't make user wait for AI
    res.json({
      success: true,
      argument: savedArgument,
      message: 'Argument posted! AI analysis incoming...'
    });

    // Run AI analysis in background
    analyzeArgumentAsync(debate, savedArgument, content, side);

  } catch (err) {
    console.error('Argue error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Background AI analysis - runs after response is sent
 */
async function analyzeArgumentAsync(debate, argument, content, side) {
  try {
    // Judge the specific argument
    const analysis = await judgeArgument(content, debate.topic, side);

    // Update the argument in the JSON array
    const currentArgs = [...(debate.arguments || [])];
    const argIndex = currentArgs.findIndex(a =>
      a.id === argument.id
    );

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

      await debate.update({ arguments: currentArgs });
    }

    // Emit to all users watching this debate (real-time update)
    if (io) {
      io.to(`debate:${debate.id}`).emit('argument-analyzed', {
        argumentId: argument.id,
        analysis,
        debateId: debate.id
      });
    }

    // Every 5 arguments, update the full debate moderation
    if (debate.arguments.length % 5 === 0) {
      const messagesForModeration = debate.arguments.map(a => ({
        sender: a.side,
        content: a.content
      }));

      const moderation = await moderateDebate(debate.topic, messagesForModeration);

      debate.aiForStrength = moderation.forStrength || 50;
      debate.aiAgainstStrength = moderation.againstStrength || 50;
      debate.aiDominantThemes = moderation.dominantThemes || [];
      debate.aiLastUpdated = new Date();

      await debate.save();

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
 * Join an existing debate room
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

    // Sequelize syntax
    const debate = await Debate.findOne({ where: { roomId, isActive: true } });

    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found or inactive'
      });
    }

    // Check if already a participant
    const alreadyJoined = debate.participants.includes(userId);

    if (!alreadyJoined) {
      // Check max participants
      if (debate.participants.length >= debate.maxParticipants) {
        return res.status(400).json({
          success: false,
          message: 'Debate room is full'
        });
      }

      // Update participants and messages JSON
      const participants = [...debate.participants, userId];
      const messages = [...debate.messages, {
        userId: 'system',
        userName: 'System',
        content: `${userName} joined the debate`,
        timestamp: new Date(),
        side: 'neutral'
      }];

      await debate.update({
        participants,
        messages,
        lastActivity: new Date()
      });
    }

    console.log(`✅ User joined debate: ${roomId}`);

    res.json({
      success: true,
      data: {
        roomId: debate.roomId,
        topic: debate.topic,
        participants: debate.participants,
        messages: debate.messages
      }
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
 * Send a message in debate room
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

    // Sequelize syntax
    const debate = await Debate.findOne({ where: { roomId: roomId, isActive: true } });

    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found'
      });
    }

    // Update messages JSON (Sequelize syntax)
    const updatedMessages = [...(debate.messages || []), {
      userId,
      userName,
      content: message,
      timestamp: new Date(),
      side: 'neutral'
    }];

    await debate.update({
      messages: updatedMessages,
      lastActivity: new Date()
    });

    let aiResponse = null;

    // Generate AI response if requested
    if (requestAIResponse) {
      try {
        const aiService = require('../services/aiService');
        const aiMessage = await aiService.generateDebateResponse(
          debate.topic,
          message,
          debate.messages
        );

        const updatedMessagesWithAI = [...(debate.messages || []), {
          userId: 'ai',
          userName: 'AI Moderator',
          content: aiMessage,
          timestamp: new Date(),
          side: 'neutral'
        }];

        await debate.update({
          messages: updatedMessagesWithAI,
          lastActivity: new Date()
        });

        aiResponse = {
          userId: 'ai',
          userName: 'AI Moderator',
          content: aiMessage,
          timestamp: new Date(),
          side: 'neutral'
        };

      } catch (aiError) {
        console.error('AI response error:', aiError);
      }
    }

    console.log(`✅ Message sent in debate: ${roomId}`);

    res.json({
      success: true,
      data: {
        userMessage: {
          userId,
          userName,
          content: message,
          timestamp: new Date(),
          side: 'neutral'
        },
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

/**
 * POST /api/debate/moderate
 * Request AI moderation
 */
router.post('/moderate', async (req, res) => {
  try {
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({
        success: false,
        message: 'Room ID is required'
      });
    }

    // Sequelize syntax
    const debate = await Debate.findOne({ where: { roomId: roomId, isActive: true } });

    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found'
      });
    }

    const aiService = require('../services/aiService');

    // Generate moderation response
    const moderation = await aiService.moderateDebate(debate.topic, debate.messages);

    // Update messages JSON
    const updatedMsgs = [...(debate.messages || []), {
      userId: 'ai',
      userName: 'AI Moderator',
      content: moderation,
      timestamp: new Date(),
      side: 'neutral'
    }];

    await debate.update({
      messages: updatedMsgs,
      lastActivity: new Date()
    });

    console.log(`✅ Moderation added to debate: ${roomId}`);

    res.json({
      success: true,
      data: {
        moderation: {
          userId: 'ai',
          userName: 'AI Moderator',
          content: moderation,
          timestamp: new Date(),
          side: 'neutral'
        }
      }
    });

  } catch (error) {
    console.error('Moderation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate moderation'
    });
  }
});

/**
 * GET /api/debate/:roomId
 * Get debate room details and messages
 */
router.get('/:roomId', async (req, res) => {
  try {
    // Sequelize syntax
    const debate = await Debate.findOne({ where: { roomId: req.params.roomId } });

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

/**
 * DELETE /api/debate/:roomId
 * Close/deactivate a debate room
 */
router.delete('/:roomId', async (req, res) => {
  try {
    const { userId } = req.body;

    // Sequelize syntax
    const debate = await Debate.findOne({ where: { roomId: req.params.roomId } });

    if (!debate) {
      return res.status(404).json({
        success: false,
        message: 'Debate room not found'
      });
    }

    // Only creator can close
    if (debate.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the creator can close this debate'
      });
    }

    await debate.update({
      isActive: false,
      status: 'closed'
    });

    console.log(`✅ Debate room closed: ${req.params.roomId}`);

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

module.exports = router;