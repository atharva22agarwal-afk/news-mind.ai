const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Debate = sequelize.define('Debate', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    summaryId: {
        type: DataTypes.STRING, // Store UUID as string
        allowNull: true
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
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'active'
    },
    participants: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    messages: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    arguments: {
        type: DataTypes.JSON,
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
    aiForStrength: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    aiAgainstStrength: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    aiDominantThemes: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    aiLastUpdated: {
        type: DataTypes.DATE,
        allowNull: true
    },
    tags: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastActivity: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'debates',
    timestamps: true,
    updatedAt: 'lastActivity'
});

// Helper methods (since virtuals/methods work differently in Sequelize)
Debate.prototype.getCurrentLeader = function () {
    const args = this.arguments || [];
    const forArgs = args.filter(a => a.side === 'for');
    const againstArgs = args.filter(a => a.side === 'against');

    const forScore = forArgs.reduce((sum, a) => sum + (a.aiStrengthScore || 0), 0);
    const againstScore = againstArgs.reduce((sum, a) => sum + (a.aiStrengthScore || 0), 0);

    if (forScore > againstScore) return 'for';
    if (againstScore > forScore) return 'against';
    return 'tie';
};

Debate.prototype.isExpired = function () {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

module.exports = Debate;
