const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PublicPost = sequelize.define('PublicPost', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    authorName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    authorId: {
        type: DataTypes.STRING, // Linking to userId from auth
        allowNull: false
    },
    type: {
        type: DataTypes.ENUM('post', 'debate', 'factcheck'),
        defaultValue: 'post'
    }
}, {
    timestamps: true
});

module.exports = PublicPost;
