const { Sequelize } = require('sequelize');
const path = require('path');

// This creates the database file automatically in your project root
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'newsmind.sqlite'),
    logging: false // cleaner console output
});

module.exports = sequelize;
