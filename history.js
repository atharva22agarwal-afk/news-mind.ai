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
    
    // Build query
    const query = { userId };
    if (source) query.source = source;
    if (depth) query.depth = depth;
    
    // Get summaries
    const summaries = await Summary.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('-originalContent'); // Exclude large content field
    
    // Get total count
    const total = await Summary.countDocuments(query);
    
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
    
    // Find debates where user is a participant
    const debates = await Debate.find({
      'participants.userId': userId
    })
      .sort({ lastActivity: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .populate('summaryId', 'title');
    
    // Get total count
    const total = await Debate.countDocuments({
      'participants.userId': userId
    });
    
    res.json({
      success: true,
      data: {
        debates,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: (parseInt(skip) + debates.length) < total
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
    const totalSummaries = await Summary.countDocuments({ userId });
    
    // Count debates
    const totalDebates = await Debate.countDocuments({
      'participants.userId': userId
    });
    
    // Count messages
    const debateMessages = await Debate.aggregate([
      { $match: { 'participants.userId': userId } },
      { $unwind: '$messages' },
      { $match: { 'messages.senderId': userId } },
      { $count: 'total' }
    ]);
    
    const totalMessages = debateMessages[0]?.total || 0;
    
    // Get summary breakdown by source
    const summaryBySource = await Summary.aggregate([
      { $match: { userId } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    // Get recent activity
    const recentSummaries = await Summary.find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title createdAt source');
    
    res.json({
      success: true,
      data: {
        totalSummaries,
        totalDebates,
        totalMessages,
        summaryBySource,
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
      _id: req.params.id, 
      userId 
    });
    
    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        message: 'Summary not found' 
      });
    }
    
    await summary.deleteOne();
    
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
      await Summary.deleteMany({ userId });
    }
    
    if (type === 'debates' || !type) {
      await Debate.updateMany(
        { 'participants.userId': userId },
        { $pull: { participants: { userId } } }
      );
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