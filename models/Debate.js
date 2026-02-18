const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Argument = sequelize.define('Argument', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    debateId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'debates',
            key: 'id'
        }
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    side: {
        type: DataTypes.ENUM('for', 'against'),
        allowNull: false
    },
    // AI Analysis fields
    aiStrengthScore: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { min: 0, max: 100 }
    },
    aiLogicalFallacies: {
        type: DataTypes.JSON, // Store as array
        defaultValue: []
    },
    aiCounterArguments: {
        type: DataTypes.JSON, // Store as array
        defaultValue: []
    },
    aiIsAnalyzed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    aiVerdict: {
        type: DataTypes.STRING,
        allowNull: true
    },
    evidenceQuality: {
        type: DataTypes.ENUM('anecdotal', 'weak', 'moderate', 'strong'),
        allowNull: true
    },
    emotionPercent: {
        type: DataTypes.INTEGER,
        validate: { min: 0, max: 100 }
    },
    logicPercent: {
        type: DataTypes.INTEGER,
        validate: { min: 0, max: 100 }
    },
    // Voting
    upVotes: {
        type: DataTypes.JSON,
        defaultValue: [] // Array of user IDs
    },
    downVotes: {
        type: DataTypes.JSON,
        defaultValue: [] // Array of user IDs
    },
    // Fact-check fields
    factCheckVerdict: {
        type: DataTypes.STRING,
        allowNull: true
    },
    factCheckConfidence: {
        type: DataTypes.INTEGER,
        validate: { min: 0, max: 100 },
        allowNull: true
    },
    factCheckExplanation: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    factCheckCheckedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'arguments',
    timestamps: true
});

const Debate = sequelize.define('Debate', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    summaryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    status: {
        type: DataTypes.ENUM('active', 'closed', 'archived'),
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
    // AI-generated debate summary
    aiForStrength: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    aiAgainstStrength: {
        type: DataTypes.INTEGER,
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
    createdAt: 'createdAt',
    updatedAt: 'lastActivity'
});

// Define associations
Debate.hasMany(Argument, { foreignKey: 'debateId', as: 'arguments' });
Argument.belongsTo(Debate, { foreignKey: 'debateId' });

// Virtual: who's winning based on AI scores
Debate.prototype.getCurrentLeader = function() {
    const args = this.arguments || [];
    const forArgs = args.filter(a => a.side === 'for');
    const againstArgs = args.filter(a => a.side === 'against');
    
    const forScore = forArgs.reduce((sum, a) => sum + (a.aiStrengthScore || 0), 0);
    const againstScore = againstArgs.reduce((sum, a) => sum + (a.aiStrengthScore || 0), 0);
    
    if (forScore > againstScore) return 'for';
    if (againstScore > forScore) return 'against';
    return 'tied';
};

module.exports = { Debate, Argument };
