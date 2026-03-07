const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
    summaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Summary',
        default: null,
        index: true
    },
    question: {
        type: String,
        required: true
    },
    optionA: {
        type: String,
        required: true
    },
    optionB: {
        type: String,
        required: true
    },
    votesA: {
        type: Number,
        default: 0
    },
    votesB: {
        type: Number,
        default: 0
    },
    voters: {
        type: [String], // Array of user IDs who voted
        default: []
    },
    userId: {
        type: String,
        default: 'guest'
    },
    // AI Insight fields
    aiInsight: {
        type: String,
        default: null
    },
    aiInsightGeneratedAt: {
        type: Date,
        default: null
    },
    aiSentimentOptionA: {
        type: String,
        enum: ['positive', 'negative', 'neutral'],
        default: null
    },
    aiSentimentOptionB: {
        type: String,
        enum: ['positive', 'negative', 'neutral'],
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    }
}, {
    timestamps: true,
    collection: 'polls'
});

// Indexes for faster queries
pollSchema.index({ summaryId: 1 });
pollSchema.index({ userId: 1 });
pollSchema.index({ status: 1 });
pollSchema.index({ createdAt: -1 });

// Virtual: calculate total votes
pollSchema.virtual('totalVotes').get(function() {
    return this.votesA + this.votesB;
});

// Virtual: get leading option
pollSchema.virtual('leadingOption').get(function() {
    if (this.votesA > this.votesB) return 'A';
    if (this.votesB > this.votesA) return 'B';
    return 'tie';
});

// Method to vote
pollSchema.methods.vote = function(userId, option) {
    // Check if user already voted
    if (this.voters.includes(userId)) {
        throw new Error('User already voted');
    }
    
    // Record vote
    if (option === 'A') {
        this.votesA += 1;
    } else if (option === 'B') {
        this.votesB += 1;
    } else {
        throw new Error('Invalid option. Use "A" or "B"');
    }
    
    this.voters.push(userId);
    return this;
};

// Method to check if user has voted
pollSchema.methods.hasVoted = function(userId) {
    return this.voters.includes(userId);
};

// Method to get results percentage
pollSchema.methods.getResults = function() {
    const total = this.votesA + this.votesB;
    if (total === 0) {
        return { A: 0, B: 0, total: 0 };
    }
    return {
        A: Math.round((this.votesA / total) * 100),
        B: Math.round((this.votesB / total) * 100),
        total
    };
};

const Poll = mongoose.model('Poll', pollSchema);

module.exports = Poll;
