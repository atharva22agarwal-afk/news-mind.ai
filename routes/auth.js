const express = require('express');
const router = express.Router();
const User = require('../models/User');

/**
 * POST /api/auth/login
 * Simple authentication (creates user if doesn't exist)
 */
router.post('/login', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Email and name are required'
      });
    }

    // Check if user exists (Sequelize syntax)
    let user = await User.findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      // Create new user
      const userId = 'user-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      user = await User.create({
        userId: userId,
        email: email.toLowerCase(),
        name: name,
        lastActive: new Date()
      });

      console.log('✅ New user created:', email);
    } else {
      // Update last active time for existing users
      await user.update({ lastActive: new Date() });
      console.log('✅ Existing user logged in:', email);
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        userId: user.userId,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
});

/**
 * GET /api/auth/user/:userId
 * Get user details
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const user = await User.findOne({ where: { userId: req.params.userId } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      }
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