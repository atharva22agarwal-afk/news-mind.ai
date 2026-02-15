const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Debate = require('../models/Debate');
const Summary = require('../models/Summary');
const aiService = require('../services/aiService');

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
    
    // Verify summary exists
    const summary = await Summary.findByPk(summaryId);
    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        message: 'Summary not found' 
      });
    }
    
    // Generate unique room ID
    const roomId = uuidv4();
    
    // Create debate room
    const debate = await Debate.create({
      summaryId,
      roomId,
      topic: summary.title,
      description: `Debate about: ${summary.title}`,
      createdBy: userId,
      participants: [{
        userId,
        userName,
        joinedAt: new Date()
      }],
      messages: [{
        sender: 'system',
        senderName: 'System',
        content: `Debate room created for "${summary.title}". Share the room ID to invite others!`,
        timestamp: new Date()
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
    
    const debate = await Debate.findOne({ roomId, isActive: true });
    
    if (!debate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Debate room not found or inactive' 
      });
    }
    
    // Check if already a participant
    const alreadyJoined = debate.participants.some(p => p.userId === userId);
    
    if (!alreadyJoined) {
      // Check max participants
      if (debate.participants.length >= debate.maxParticipants) {
        return res.status(400).json({ 
          success: false, 
          message: 'Debate room is full' 
        });
      }
      
      // Add participant
      debate.participants.push({
        userId,
        userName,
        joinedAt: new Date()
      });
      
      // Add system message
      debate.messages.push({
        sender: 'system',
        senderName: 'System',
        content: `${userName} joined the debate`,
        timestamp: new Date()
      });
      
      await debate.save();
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
    
    const debate = await Debate.findOne({ where: { roomId: roomId, isActive: true } });
    
    if (!debate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Debate room not found' 
      });
    }
    
    // Add user message
    debate.messages.push({
      sender: 'user',
      senderId: userId,
      senderName: userName,
      content: message,
      timestamp: new Date()
    });
    
    await debate.save();
    
    let aiResponse = null;
    
    // Generate AI response if requested
    if (requestAIResponse) {
      try {
        const aiMessage = await aiService.generateDebateResponse(
          debate.topic, 
          message, 
          debate.messages
        );
        
        debate.messages.push({
          sender: 'ai',
          senderName: 'AI Moderator',
          content: aiMessage,
          timestamp: new Date()
        });
        
        await debate.save();
        
        aiResponse = {
          sender: 'ai',
          senderName: 'AI Moderator',
          content: aiMessage,
          timestamp: new Date()
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
          sender: 'user',
          senderName: userName,
          content: message,
          timestamp: new Date()
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
    
    const debate = await Debate.findOne({ where: { roomId: roomId, isActive: true } });
    
    if (!debate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Debate room not found' 
      });
    }
    
    // Generate moderation response
    const moderation = await aiService.moderateDebate(debate.topic, debate.messages);
    
    // Add moderation message
    debate.messages.push({
      sender: 'ai',
      senderName: 'AI Moderator',
      content: moderation,
      timestamp: new Date()
    });
    
    await debate.save();
    
    console.log(`✅ Moderation added to debate: ${roomId}`);
    
    res.json({
      success: true,
      data: {
        moderation: {
          sender: 'ai',
          senderName: 'AI Moderator',
          content: moderation,
          timestamp: new Date()
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
    const debate = await Debate.findOne({ 
      where: { roomId: req.params.roomId }
    });
    
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
    
    debate.isActive = false;
    await debate.save();
    
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