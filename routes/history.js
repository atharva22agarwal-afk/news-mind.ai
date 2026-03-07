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
    
    // Build query filter
    const filter = { userId };
    if (source) filter.source = source;
    if (depth) filter.depth = depth;
    
    // Get summaries (Mongoose syntax)
    const summaries = await Summary.find(filter)
      .select('-originalContent') // Exclude originalContent
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    // Get total count
    const total = await Summary.countDocuments(filter);
    
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
    
    // Find debates where user is in participants array (Mongoose syntax)
    const debates = await Debate.find({ 
      isActive: true,
      participants: { $in: [userId] }
    })
      .sort({ lastActivity: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));
    
    // Get total count
    const total = await Debate.countDocuments({ 
      isActive: true,
      participants: { $in: [userId] }
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
    
    // Count debates where user is a participant
    const totalDebates = await Debate.countDocuments({
      participants: { $in: [userId] }
    });
    
    // Count messages in debates
    const debatesWithUser = await Debate.find({
      participants: { $in: [userId] }
    });
    
    let totalMessages = 0;
    debatesWithUser.forEach(debate => {
      const messages = debate.messages || [];
      totalMessages += messages.filter(m => m.userId === userId).length;
    });
    
    // Get summary breakdown by source
    const summaryBySource = await Summary.aggregate([
      { $match: { userId } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    const summaryBySourceArray = summaryBySource.map(s => ({ 
      source: s._id, 
      count: s.count 
    }));
    
    // Get recent activity
    const recentSummaries = await Summary.find({ userId })
      .select('title createdAt source')
      .sort({ createdAt: -1 })
      .limit(5);
    
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
    
    // Mongoose syntax
    const summary = await Summary.findOneAndDelete({ 
      _id: req.params.id, 
      userId 
    });
    
    if (!summary) {
      return res.status(404).json({ 
        success: false, 
        message: 'Summary not found' 
      });
    }
    
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
      // For debates, update to remove user from participants or mark as inactive
      await Debate.updateMany(
        { participants: { $in: [userId] } },
        { 
          $pull: { participants: userId },
          $set: { isActive: false }
        }
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
