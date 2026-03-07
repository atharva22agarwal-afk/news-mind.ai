const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    name: {
        type: String,
        default: 'Anonymous User'
    },
    email: {
        type: String,
        default: null
    },
    preferences: {
        type: Object,
        default: {
            defaultDepth: 'medium',
            autoGenerateAudio: false,
            voiceLanguage: 'en-US'
        }
    },
    stats: {
        type: Object,
        default: {
            totalSummaries: 0,
            totalDebates: 0,
            totalMessages: 0
        }
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastActive' },
    collection: 'users'
});

// Index for faster queries
userSchema.index({ userId: 1 });
userSchema.index({ lastActive: -1 });

const User = mongoose.model('User', userSchema);

module.exports = User;
