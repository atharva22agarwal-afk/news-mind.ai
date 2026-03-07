const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Determine database config based on environment
let sequelize;

if (process.env.DATABASE_URL) {
    // Production: Use DATABASE_URL (Postgres, etc.)
    console.log('🌐 Using Production Database (via DATABASE_URL)');
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false // Necessary for Vercel/Neon Postgres
            }
        },
        logging: false
    });
} else {
    // Development: Use local SQLite
    console.log('📂 Using Local SQLite Database');
    sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: path.join(__dirname, '..', 'newsmind.sqlite'),
        logging: false
    });
}

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Database Connected Successfully');

        // Auto-sync in development or if FORCE_SYNC is set
        if (process.env.NODE_ENV !== 'production' || process.env.FORCE_SYNC === 'true') {
            await sequelize.sync({ alter: true });
            console.log('✅ Database Synced');
        }
    } catch (error) {
        console.error('❌ Database Connection Error:', error.message);
        if (!process.env.VERCEL) {
            process.exit(1);
        }
        throw error;
    }
};

const getConnection = async () => {
    return sequelize;
};

module.exports = { connectDB, getConnection, sequelize, mongoose: {} };
