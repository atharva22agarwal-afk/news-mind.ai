const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Summary = sequelize.define('Summary', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'guest'
    },
    source: {
        type: DataTypes.ENUM('text', 'url', 'file', 'search'),
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
    headline: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tldr: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    keyPoints: {
        type: DataTypes.JSON, // SQLite stores this as stringified JSON
        defaultValue: []
    },
    insights: {
        type: DataTypes.JSON,
        defaultValue: {
            political: null,
            economic: null,
            social: null,
            environmental: null,
            legal: null,
            technological: null,
            ethical: null
        }
    },
    sentiment: {
        type: DataTypes.STRING,
        defaultValue: null
    },
    biasAnalysis: {
        type: DataTypes.JSON,
        defaultValue: null
    },
    wordCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    readingTime: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    language: {
        type: DataTypes.STRING,
        defaultValue: 'en'
    },
    topics: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    entities: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    audioUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    audioGeneratedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    viewCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    isFavorite: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'summaries',
    timestamps: true,
    indexes: [
        {
            fields: ['sourceUrl'],
            name: 'idx_summaries_source_url'
        },
        {
            fields: ['userId'],
            name: 'idx_summaries_user_id'
        },
        {
            fields: ['createdAt'],
            name: 'idx_summaries_created_at'
        }
    ]
});

module.exports = Summary;
