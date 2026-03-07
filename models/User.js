const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
    userId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        defaultValue: 'Anonymous User'
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    preferences: {
        type: DataTypes.JSON,
        defaultValue: {
            defaultDepth: 'medium',
            autoGenerateAudio: false,
            voiceLanguage: 'en-US'
        }
    },
    stats: {
        type: DataTypes.JSON,
        defaultValue: {
            totalSummaries: 0,
            totalDebates: 0,
            totalMessages: 0
        }
    },
    lastActive: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'lastActive'
});

module.exports = User;
