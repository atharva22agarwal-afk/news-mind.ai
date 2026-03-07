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

    // Get summaries (Sequelize syntax)
    const { Op } = require('sequelize');
    const { count, rows: summaries } = await Summary.findAndCountAll({
      where: filter,
      attributes: { exclude: ['originalContent'] },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(skip)
    });

    const total = count;

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

    // Find debates where user is in participants array (Sequelize syntax)
    const { Op } = require('sequelize');
    const { count, rows: debates } = await Debate.findAndCountAll({
      where: {
        isActive: true,
        participants: { [Op.like]: `%${userId}%` }
      },
      order: [['lastActivity', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(skip)
    });

    const total = count;

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
    const totalSummaries = await Summary.count({ where: { userId } });

    // Count debates where user is a participant
    const { Op } = require('sequelize');
    const totalDebates = await Debate.count({
      where: {
        participants: { [Op.like]: `%${userId}%` }
      }
    });

    // Get recent activity
    const recentSummaries = await Summary.findAll({
      where: { userId },
      attributes: ['title', 'createdAt', 'source'],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // Summary breakdown by source
    const { sequelize } = require('../config/database');
    const sources = await Summary.findAll({
      where: { userId },
      attributes: ['source', [sequelize.fn('COUNT', sequelize.col('source')), 'count']],
      group: ['source']
    });

    const summaryBySourceArray = sources.map(s => ({
      source: s.source,
      count: s.get('count')
    }));

    res.json({
      success: true,
      data: {
        totalSummaries,
        totalDebates,
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

    // Sequelize syntax
    const summary = await Summary.findOne({
      where: { id: req.params.id, userId }
    });

    if (summary) {
      await summary.destroy();
    }

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

    const { Op } = require('sequelize');
    if (type === 'summaries' || !type) {
      await Summary.destroy({ where: { userId } });
    }

    if (type === 'debates' || !type) {
      // For debates, update to mark as inactive (simplified)
      await Debate.update(
        { isActive: false },
        { where: { participants: { [Op.like]: `%${userId}%` } } }
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
