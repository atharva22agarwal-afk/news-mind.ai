const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Debate = sequelize.define('Debate', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    summaryId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'summaries',
            key: 'id'
        }
    },
    roomId: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    topic: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: true
    },
    participants: {
        type: DataTypes.JSON, // Store as JSON array
        defaultValue: []
    },
    messages: {
        type: DataTypes.JSON, // Store as JSON array
        defaultValue: []
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    maxParticipants: {
        type: DataTypes.INTEGER,
        defaultValue: 10
    },
    createdBy: {
        type: DataTypes.STRING,
        defaultValue: 'guest'
    },
    lastActivity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'debates',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'lastActivity'
});

module.exports = Debate;
