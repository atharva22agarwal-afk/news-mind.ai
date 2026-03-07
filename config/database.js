const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Determine database config based on environment
let sequelize;
const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (dbUrl) {
    // Production: Use DATABASE_URL (Postgres, etc.)
    console.log('🌐 Using Production Database');
    sequelize = new Sequelize(dbUrl, {
        dialect: 'postgres',
        dialectModule: require('pg'), // Explicitly pass pg for Vercel
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        },
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    });
} else if (process.env.VERCEL) {
    // Vercel Serverless cannot run SQLite reliably. We must enforce Postgres.
    console.error('❌ CRITICAL: Vercel Postgres is not connected!');
    throw new Error('DATABASE_URL is missing! Please go to your Vercel Dashboard -> Storage -> Create Postgres Database and connect it to this project.');
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
