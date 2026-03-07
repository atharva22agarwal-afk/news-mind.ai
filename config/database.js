const mongoose = require('mongoose');

// MongoDB Connection URI from environment variable
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/newsmind';

// Connection options
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

// Connect to MongoDB
const connectDB = async () => {
    try {
        if (mongoose.connection.readyState >= 1) {
            console.log('📊 MongoDB Already Connected');
            return;
        }

        await mongoose.connect(MONGODB_URI, options);
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error.message);
        // Don't exit process on Vercel serverless environment
        if (!process.env.VERCEL) {
            process.exit(1);
        }
        throw error;
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('📊 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('📊 Mongoose disconnected');
});

// For Vercel serverless - ensure connection is ready
const getConnection = async () => {
    if (mongoose.connection.readyState !== 1) {
        await connectDB();
    }
    return mongoose.connection;
};

module.exports = { connectDB, getConnection, mongoose };
