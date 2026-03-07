const mongoose = require('mongoose');

// Argument Schema (embedded in Debate)
const argumentSchema = new mongoose.Schema({
    userId: {
        type: String,
        default: null
    },
    content: {
        type: String,
        required: true
    },
    side: {
        type: String,
        enum: ['for', 'against'],
        required: true
    },
    // AI Analysis fields
    aiStrengthScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    aiLogicalFallacies: {
        type: [String],
        default: []
    },
    aiCounterArguments: {
        type: [String],
        default: []
    },
    aiIsAnalyzed: {
        type: Boolean,
        default: false
    },
    aiVerdict: {
        type: String,
        default: null
    },
    evidenceQuality: {
        type: String,
        enum: ['anecdotal', 'weak', 'moderate', 'strong'],
        default: null
    },
    emotionPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    logicPercent: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    // Voting
    upVotes: {
        type: [String], // Array of user IDs
        default: []
    },
    downVotes: {
        type: [String], // Array of user IDs
        default: []
    },
    // Fact-check fields
    factCheckVerdict: {
        type: String,
        default: null
    },
    factCheckConfidence: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    factCheckExplanation: {
        type: String,
        default: null
    },
    factCheckCheckedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Message Schema (embedded in Debate)
const messageSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        default: 'Anonymous'
    },
    content: {
        type: String,
        required: true
    },
    side: {
        type: String,
        enum: ['for', 'against', 'neutral'],
        default: 'neutral'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Debate Schema
const debateSchema = new mongoose.Schema({
    summaryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Summary',
        default: null,
        index: true
    },
    roomId: {
        type: String,
        unique: true,
        required: true,
        index: true
    },
    topic: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'closed', 'archived'],
        default: 'active'
    },
    participants: {
        type: [String], // Array of user IDs
        default: []
    },
    messages: [messageSchema],
    arguments: [argumentSchema],
    isActive: {
        type: Boolean,
        default: true
    },
    maxParticipants: {
        type: Number,
        default: 10
    },
    createdBy: {
        type: String,
        default: 'guest'
    },
    // AI-generated debate summary
    aiForStrength: {
        type: Number,
        default: null
    },
    aiAgainstStrength: {
        type: Number,
        default: null
    },
    aiDominantThemes: {
        type: [String],
        default: []
    },
    aiLastUpdated: {
        type: Date,
        default: null
    },
    tags: {
        type: [String],
        default: []
    },
    expiresAt: {
        type: Date,
        default: null
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: 'lastActivity' },
    collection: 'debates'
});

// Indexes for faster queries
debateSchema.index({ roomId: 1 });
debateSchema.index({ status: 1 });
debateSchema.index({ createdBy: 1 });
debateSchema.index({ lastActivity: -1 });
debateSchema.index({ tags: 1 });

// Virtual: who's winning based on AI scores
debateSchema.methods.getCurrentLeader = function() {
    const args = this.arguments || [];
    const forArgs = args.filter(a => a.side === 'for');
    const againstArgs = args.filter(a => a.side === 'against');
    
    const forScore = forArgs.reduce((sum, a) => sum + (a.aiStrengthScore || 0), 0);
    const againstScore = againstArgs.reduce((sum, a) => sum + (a.aiStrengthScore || 0), 0);
    
    if (forScore > againstScore) return 'for';
    if (againstScore > forScore) return 'against';
    return 'tie';
};

// Virtual: calculate total engagement
debateSchema.virtual('engagement').get(function() {
    return {
        argumentCount: this.arguments?.length || 0,
        messageCount: this.messages?.length || 0,
        participantCount: this.participants?.length || 0,
        totalVotes: this.arguments?.reduce((sum, arg) => 
            sum + (arg.upVotes?.length || 0) + (arg.downVotes?.length || 0), 0
        ) || 0
    };
});

// Method to check if debate is expired
debateSchema.methods.isExpired = function() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

// Method to add participant
debateSchema.methods.addParticipant = function(userId) {
    if (!this.participants.includes(userId)) {
        this.participants.push(userId);
    }
    return this;
};

// Method to add message
debateSchema.methods.addMessage = function(userId, userName, content, side = 'neutral') {
    this.messages.push({
        userId,
        userName,
        content,
        side,
        timestamp: new Date()
    });
    this.lastActivity = new Date();
    return this;
};

// Method to add argument
debateSchema.methods.addArgument = function(argumentData) {
    this.arguments.push(argumentData);
    this.lastActivity = new Date();
    return this;
};

const Debate = mongoose.model('Debate', debateSchema);

module.exports = Debate;
