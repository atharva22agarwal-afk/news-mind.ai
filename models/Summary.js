const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Summary = sequelize.define('Summary', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'guest'
    },
    source: {
        type: DataTypes.ENUM('text', 'url', 'file'),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    originalContent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    sourceUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    fileName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    // Structured AI output fields
    headline: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tldr: {
        type: DataTypes.TEXT, // One-line summary
        allowNull: true
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    keyPoints: {
        type: DataTypes.JSON, // Store as JSON array
        defaultValue: []
    },
    sentiment: {
        type: DataTypes.ENUM('positive', 'negative', 'neutral', 'mixed'),
        allowNull: true
    },
    biasWarning: {
        type: DataTypes.TEXT, // Flag potential bias
        allowNull: true
    },
    biasScore: {
        type: DataTypes.INTEGER, // -5 (left) to 5 (right)
        validate: { min: -5, max: 5 },
        allowNull: true
    },
    credibilityFlags: {
        type: DataTypes.JSON, // Array of red flags
        defaultValue: []
    },
    readTime: {
        type: DataTypes.INTEGER, // Estimated minutes
        defaultValue: 0
    },
    category: {
        type: DataTypes.STRING, // auto-classified topic
        allowNull: true
    },
    relatedDebateId: {
        type: DataTypes.INTEGER, // Link to debate
        allowNull: true
    },
    depth: {
        type: DataTypes.ENUM('brief', 'medium', 'detailed'),
        defaultValue: 'medium'
    },
    wordCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    readingTime: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    model: {
        type: DataTypes.STRING,
        defaultValue: 'llama-3.3-70b-versatile'
    },
    provider: {
        type: DataTypes.STRING,
        defaultValue: 'Groq AI'
    },
    audioUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pageCount: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    isPublic: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    viewCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'summaries',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Summary;
