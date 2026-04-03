const express = require('express');
const router = express.Router();
const firestore = require('../services/firestoreService');
const { auth } = require('../config/firebase');

/**
 * POST /api/auth/login
 * Firebase login (verifies token and ensures user exists in Firestore)
 */
router.post('/login', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required'
      });
    }

    // Verify token
    const decodedToken = await auth.verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // Check if user exists in Firestore
    let user = await firestore.getById('users', uid);

    if (!user) {
      // Create new user record
      user = {
        userId: uid,
        email: email || '',
        name: name || 'Anonymous User',
        picture: picture || '',
        preferences: {
          defaultDepth: 'medium',
          autoGenerateAudio: false,
          voiceLanguage: 'en-US'
        },
        stats: {
          totalSummaries: 0,
          totalDebates: 0,
          totalMessages: 0
        },
        lastActive: new Date()
      };

      await firestore.create('users', user, uid);
      console.log('✅ New Firebase user created:', email);
    } else {
      // Update last active time
      await firestore.update('users', uid, { lastActive: new Date() });
      console.log('✅ Existing Firebase user logged in:', email);
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: user
    });

  } catch (error) {
    console.error('❌ Firebase Auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
});

/**
 * GET /api/auth/user/:userId
 * Get user details from Firestore
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await firestore.getById('users', req.params.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
      error: error.message
    });
  }
});

module.exports = router;