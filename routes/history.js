const express = require('express');
const router = express.Router();
const Summary = require('../models/Summary');
const Debate = require('../models/Debate');

/**
 * GET /api/history/summaries
 * Get user's summary history
 */
router.get('/summaries', async (req, res) => {
  try {
    const { 
      userId = 'guest', 
      limit = 20, 
      skip = 0,
      source,
      depth 
    } = req.query;
    
    // Build where clause
    const where = { userId };
    if (source) where.source = source;
    if (depth) where.depth = depth;
    
    // Get summaries
    const summaries = await Summary.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(skip),
      attributes: { exclude: ['originalContent'] }
    });
    
    // Get total count
    const total = await Summary.count({ where });
    
    res.json({
      success: true,
      data: {
        summaries,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: (parseInt(skip) + summaries.length) < total
        }
      }
    });
    
  } catch (error) {
    console.error('Get summaries error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve summaries' 
    });
  }
});

/**
 * GET /api/history/debates
 * Get user's debate history
 */
router.get('/debates', async (req, res) => {
  try {
    const { userId = 'guest', limit = 20, skip = 0 } = req.query;
    
    // Find debates where user is a participant (stored as JSON)
    const debates = await Debate.findAll({
      where: { isActive: true },
      order: [['lastActivity', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(skip)
    });
    
    // Filter by userId in participants (client-side for JSON field)
    const userDebates = debates.filter(d => {
      const participants = d.participants || [];
      return participants.some(p => p.userId === userId);
    });
    
    // Get total count
    const total = await Debate.count({ where: { isActive: true } });
    
    res.json({
      success: true,
      data: {
        debates: userDebates,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: (parseInt(skip) + userDebates.length) < total
        }
      }
    });
    
  } catch (error) {
    console.error('Get debates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve debates' 
    });
  }
});

/**
 * GET /api/history/stats
 * Get user statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { userId = 'guest' } = req.query;
    
    // Count summaries
    const totalSummaries = await Summary.count({ where: { userId } });
    
    // Count debates - get all and filter
    const allDebates = await Debate.findAll();
    const userDebates = allDebates.filter(d => {
      const participants = d.participants || [];
      return participants.some(p => p.userId === userId);
    });
    const totalDebates = userDebates.length;
    
    // Count messages
    let totalMessages = 0;
    userDebates.forEach(debate => {
      const messages = debate.messages || [];
      totalMessages += messages.filter(m => m.senderId === userId).length;
    });
    
    // Get summary breakdown by source
    const summaries = await Summary.findAll({ where: { userId } });
    const summaryBySource = {};
    summaries.forEach(s => {
      summaryBySource[s.source] = (summaryBySource[s.source] || 0) + 1;
    });
    const summaryBySourceArray = Object.entries(summaryBySource).map(([id, count]) => ({ source: id, count }));
    
    // Get recent activity
    const recentSummaries = await Summary.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['title', 'createdAt', 'source']
    });
    
    res.json({
      success: true,
      data: {
        totalSummaries,
        totalDebates,
        totalMessages,
        summaryBySource: summaryBySourceArray,
        recentActivity: recentSummaries
      }
    });
    
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve stats' 
    });
  }
});

/**
 * DELETE /api/history/summary/:id
 * Delete a specific summary
 */
router.delete('/summary/:id', async (req, res) => {
  try {
    const { userId = 'guest' } = req.body;
    
    const summary = await Summary.findOne({ 
      where: { 
        id: req.params.id, 
        userId 
      }
    });
    
    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        message: 'Summary not found' 
      });
    }
    
    await summary.destroy();
    
    console.log(`✅ Summary deleted: ${req.params.id}`);
    
    res.json({
      success: true,
      message: 'Summary deleted successfully'
    });
    
  } catch (error) {
    console.error('Delete summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete summary' 
    });
  }
});

/**
 * DELETE /api/history/clear
 * Clear all user history
 */
router.delete('/clear', async (req, res) => {
  try {
    const { userId = 'guest', type } = req.body;
    
    if (type === 'summaries' || !type) {
      await Summary.destroy({ where: { userId } });
    }
    
    if (type === 'debates' || !type) {
      // For debates, just mark as inactive
      const debates = await Debate.findAll();
      for (const debate of debates) {
        const participants = debate.participants || [];
        if (participants.some(p => p.userId === userId)) {
          debate.isActive = false;
          await debate.save();
        }
      }
    }
    
    console.log(`✅ History cleared for user: ${userId}`);
    
    res.json({
      success: true,
      message: 'History cleared successfully'
    });
    
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear history' 
    });
  }
});

module.exports = router;
