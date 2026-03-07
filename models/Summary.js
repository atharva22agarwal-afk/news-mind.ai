const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        default: 'guest',
        index: true
    },
    source: {
        type: String,
        enum: ['text', 'url', 'file'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    originalContent: {
        type: String,
        default: null
    },
    sourceUrl: {
        type: String,
        default: null
    },
    fileName: {
        type: String,
        default: null
    },
    // Structured AI output fields
    headline: {
        type: String,
        default: null
    },
    tldr: {
        type: String, // One-line summary
        default: null
    },
    summary: {
        type: String,
        required: true
    },
    keyPoints: {
        type: [String], // Array of strings
        default: []
    },
    // Categorized insights
    insights: {
        political: {
            type: String,
            default: null
        },
        economic: {
            type: String,
            default: null
        },
        social: {
            type: String,
            default: null
        },
        environmental: {
            type: String,
            default: null
        },
        legal: {
            type: String,
            default: null
        },
        technological: {
            type: String,
            default: null
        },
        ethical: {
            type: String,
            default: null
        }
    },
    // Analysis
    sentiment: {
        type: String,
        enum: ['positive', 'negative', 'neutral', 'mixed'],
        default: null
    },
    biasAnalysis: {
        type: Object,
        default: null
    },
    // Metadata
    wordCount: {
        type: Number,
        default: 0
    },
    readingTime: {
        type: Number, // in minutes
        default: 0
    },
    language: {
        type: String,
        default: 'en'
    },
    // Related entities
    topics: {
        type: [String],
        default: []
    },
    entities: {
        type: [String],
        default: []
    },
    // Audio generation
    audioUrl: {
        type: String,
        default: null
    },
    audioGeneratedAt: {
        type: Date,
        default: null
    },
    // Engagement
    viewCount: {
        type: Number,
        default: 0
    },
    isFavorite: {
        type: Boolean,
        default: false
    },
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    collection: 'summaries'
});

// Indexes for faster queries
summarySchema.index({ userId: 1, createdAt: -1 });
summarySchema.index({ userId: 1, isFavorite: 1 });
summarySchema.index({ topics: 1 });
summarySchema.index({ createdAt: -1 });

const Summary = mongoose.model('Summary', summarySchema);

module.exports = Summary;
