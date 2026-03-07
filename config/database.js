const { Sequelize } = require('sequelize');
const path = require('path');

// Use /tmp for serverless environments (Vercel), otherwise use project root
const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === 'production';
const storagePath = isServerless
  ? path.join('/tmp', 'newsmind.sqlite')
  : path.join(__dirname, '..', 'newsmind.sqlite');

console.log(`📊 SQLite Database path: ${storagePath}`);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: storagePath,
    logging: false // cleaner console output
});

// Sync database on startup
sequelize.sync({ force: false }).then(() => {
  console.log('✅ SQLite Database Connected & Synced');
}).catch(err => {
  console.error('❌ Database Error:', err);
});

module.exports = sequelize;
