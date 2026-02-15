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
    userId: {
        type: DataTypes.STRING,
        defaultValue: 'guest'
    }
}, {
    tableName: 'polls',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
});

module.exports = Poll;
