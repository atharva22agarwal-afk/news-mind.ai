const express = require('express');
const router = express.Router();
const PublicPost = require('../models/PublicPost');

// Get latest public posts
router.get('/latest', async (req, res) => {
    try {
        const posts = await PublicPost.findAll({
            limit: 50,
            order: [['createdAt', 'DESC']]
        });
        res.json({ success: true, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create a new public post
router.post('/post', async (req, res) => {
    try {
        const { content, authorName, authorId, type } = req.body;

        if (!content || !authorName || !authorId) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const post = await PublicPost.create({
            content,
            authorName,
            authorId,
            type: type || 'post'
        });

        // Broadcast will be handled via Socket.io in server.js
        res.json({ success: true, data: post });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
