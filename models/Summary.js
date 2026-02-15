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
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    keyPoints: {
        type: DataTypes.JSON, // Store as JSON array
        defaultValue: []
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
        defaultValue: 'extractive-summarization-v1'
    },
    provider: {
        type: DataTypes.STRING,
        defaultValue: 'Built-in Algorithm'
    },
    audioUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pageCount: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'summaries',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Summary;
