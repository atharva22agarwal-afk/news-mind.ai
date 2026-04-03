const express = require('express');
const router = express.Router();
const firestore = require('../services/firestoreService');

// Get latest public posts from Firestore
router.get('/latest', async (req, res) => {
    try {
        const posts = await firestore.list('public_posts', [], 50, 'createdAt', 'desc');
        res.json({ success: true, data: posts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Create a new public post in Firestore
router.post('/post', async (req, res) => {
    try {
        const { content, authorName, authorId, type } = req.body;

        if (!content || !authorName || !authorId) {
            return res.status(400).json({ success: false, message: 'Missing fields' });
        }

        const postData = {
            content,
            authorName,
            authorId,
            type: type || 'post',
            createdAt: new Date()
        };

        const post = await firestore.create('public_posts', postData);

        // Broadcast will be handled via Socket.io in server.js
        res.json({ success: true, data: { id: post.id, ...postData } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
