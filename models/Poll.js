const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Poll = sequelize.define('Poll', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    summaryId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    question: {
        type: DataTypes.STRING,
        allowNull: false
    },
    optionA: {
        type: DataTypes.STRING,
        allowNull: false
    },
    optionB: {
        type: DataTypes.STRING,
        allowNull: false
    },
    votesA: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    votesB: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    voters: {
        type: DataTypes.JSON, // Array of user IDs who voted
        defaultValue: []
    },
    userId: {
        type: DataTypes.STRING,
        defaultValue: 'guest'
    },
    // AI Insight fields
    aiInsight: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    aiInsightGeneratedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'closed'),
        defaultValue: 'active'
    }
}, {
    tableName: 'polls',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Poll;
