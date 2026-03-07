const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Poll = sequelize.define('Poll', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    summaryId: {
        type: DataTypes.STRING,
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
        type: DataTypes.JSON,
        defaultValue: []
    },
    userId: {
        type: DataTypes.STRING,
        defaultValue: 'guest'
    },
    aiInsight: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    aiInsightGeneratedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    aiSentimentOptionA: {
        type: DataTypes.STRING,
        allowNull: true
    },
    aiSentimentOptionB: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'active'
    }
}, {
    tableName: 'polls',
    timestamps: true
});

// Helper methods
Poll.prototype.getResults = function () {
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

module.exports = Poll;
