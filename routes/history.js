const express = require('express');
const router = express.Router();
const firestore = require('../services/firestoreService');

// Constants
const MAX_HISTORY_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * GET /api/history/summaries
 * Get user's summary history from Firestore with proper pagination
 */
router.get('/summaries', async (req, res) => {
  try {
    const {
      userId = 'guest',
      limit = DEFAULT_LIMIT,
      skip = 0,
      source,
      depth,
      startAfter // Cursor for pagination
    } = req.query;

    // Build filters for firestore.list
    const filters = [{ field: 'userId', operator: '==', value: userId }];
    if (source) filters.push({ field: 'source', operator: '==', value: source });
    if (depth) filters.push({ field: 'depth', operator: '==', value: depth });

    // Use enhanced list - note: requires composite index for orderBy
    // If index is not built, will fetch and sort in memory
    let result;
    try {
      result = await firestore.list(
        'summaries', 
        filters, 
        parseInt(limit) || DEFAULT_LIMIT, 
        'createdAt', 
        'desc',
        startAfter
      );
    } catch (indexError) {
      // Fallback: fetch without orderBy and sort in memory
      console.warn('Index not available, using in-memory sort');
      const unsorted = await firestore.list(
        'summaries', 
        filters, 
        100, // Fetch more for sorting
        null, // No orderBy
        'desc'
      );
      
      // Sort in memory
      const sorted = unsorted.documents.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return timeB - timeA;
      });
      
      // Apply pagination
      const paginated = sorted.slice(0, parseInt(limit) || DEFAULT_LIMIT);
      result = {
        documents: paginated,
        hasMore: sorted.length > (parseInt(limit) || DEFAULT_LIMIT),
        nextCursor: paginated.length > 0 ? { id: paginated[paginated.length - 1].id } : null
      };
    }

    const summaries = result.documents.map(doc => ({
      ...doc,
      _cursor: undefined // Remove internal cursor from response
    }));

    res.json({
      success: true,
      data: {
        summaries,
        pagination: {
          total: summaries.length,
          limit: parseInt(limit) || DEFAULT_LIMIT,
          skip: parseInt(skip) || 0,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor?.id || null
        }
      }
    });

  } catch (error) {
    console.error('Get summaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve summaries: ' + error.message
    });
  }
});

/**
 * GET /api/history/debates
 */
router.get('/debates', async (req, res) => {
  try {
    const { userId = 'guest', limit = DEFAULT_LIMIT } = req.query;

    const filters = [{ field: 'participants', operator: 'array-contains', value: userId }];
    const result = await firestore.list(
      'debates', 
      filters, 
      parseInt(limit) || DEFAULT_LIMIT, 
      'lastActivity', 
      'desc'
    );

    const debates = result.documents;

    res.json({
      success: true,
      data: {
        debates,
        pagination: {
          total: debates.length,
          limit: parseInt(limit) || DEFAULT_LIMIT,
          hasMore: result.hasMore,
          nextCursor: result.nextCursor?.id || null
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
 * Get user statistics with efficient counting
 */
router.get('/stats', async (req, res) => {
  try {
    const { userId = 'guest' } = req.query;

    // Use efficient count with limits (Firestore doesn't support cheap counts)
    const summariesResult = await firestore.count(
      'summaries', 
      [{ field: 'userId', operator: '==', value: userId }]
    );
    const debatesResult = await firestore.count(
      'debates', 
      [{ field: 'participants', operator: 'array-contains', value: userId }]
    );

    // Get recent activity (limited for efficiency)
    const recentSummaries = await firestore.list(
      'summaries',
      [{ field: 'userId', operator: '==', value: userId }],
      5,
      'createdAt',
      'desc'
    );

    res.json({
      success: true,
      data: {
        totalSummaries: summariesResult.count,
        totalDebates: debatesResult.count,
        summaryCountNote: summariesResult.message,
        recentActivity: recentSummaries.documents.slice(0, 5).map(s => ({
          title: s.title,
          createdAt: s.createdAt,
          source: s.source
        }))
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
 */
router.delete('/summary/:id', async (req, res) => {
  try {
    const { userId = 'guest' } = req.body;

    const summary = await firestore.getById('summaries', req.params.id);

    if (summary && summary.userId === userId) {
      await firestore.delete('summaries', req.params.id);
      res.json({ success: true, message: 'Summary deleted' });
    } else {
      res.status(404).json({ success: false, message: 'Summary not found or unauthorized' });
    }

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
 * Batch delete user history efficiently
 */
router.delete('/clear', async (req, res) => {
  try {
    const { userId = 'guest', type } = req.body;

    if (type === 'summaries' || !type) {
      // Use batch delete for efficiency (up to 500 docs per batch)
      const result = await firestore.batchDelete('summaries', 'userId', userId, 500);
      console.log(`Cleared ${result.deleted} summaries for user ${userId}`);
    }

    if (type === 'debates' || !type) {
      // For debates, we need to filter by participant array
      // This is more complex - delete debates where user is creator
      const debates = await firestore.list('debates', [
        { field: 'createdBy', operator: '==', value: userId }
      ], 500);
      
      for (const debate of debates.documents) {
        await firestore.delete('debates', debate.id);
      }
    }

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
