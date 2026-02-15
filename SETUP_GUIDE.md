# NewsMind AI - Setup Guide

## Overview
NewsMind AI is a news summarization and AI debate platform that allows users to:
- Summarize articles from URLs
- Upload and summarize PDF, DOC, DOCX, and TXT files
- Chat with an AI moderator about the content
- View history of past summaries

## Prerequisites

Before starting, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify installation: `node --version`

2. **MongoDB Database**
   - The project uses MongoDB Atlas (cloud) by default
   - Connection string is already configured in `.env`
   - Alternatively, you can use a local MongoDB instance

## Installation Steps

### Step 1: Install Node.js

**Windows:**
1. Download the LTS version from https://nodejs.org/
2. Run the installer and follow the prompts
3. Restart your terminal/command prompt
4. Verify: `node --version` and `npm --version`

**macOS:**
```bash
# Using Homebrew
brew install node

# Verify
node --version
npm --version
```

**Linux:**
```bash
# Using apt (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

### Step 2: Install Dependencies

Open a terminal in the project directory and run:

```bash
npm install
```

This will install all required packages including:
- Express.js (web server)
- Mongoose (MongoDB ODM)
- Multer (file uploads)
- Cheerio (web scraping)
- PDF-parse (PDF processing)
- And other dependencies

### Step 3: Environment Configuration

The `.env` file is already configured with:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/newsmind
NODE_ENV=development
```

**Note:** The MongoDB connection uses a local database. Make sure MongoDB is running on your system, or use MongoDB Atlas for cloud storage.

### Step 4: Start the Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

You should see output like:
```
🚀 Server running on http://localhost:5000
📱 Access from other devices: http://YOUR_IP:5000
📚 API Documentation: http://localhost:5000/
✅ MongoDB Connected Successfully
📊 Database: newsmind-db
```

### Step 5: Access the Application

Open your browser and navigate to:
- **Main Page:** http://localhost:5000
- **Login:** http://localhost:5000/login.html
- **Dashboard:** http://localhost:5000/dashboard.html

## Project Structure

```
news/
├── server.js              # Main server entry point
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── api-config.js          # Frontend API configuration
│
├── routes/                # API route handlers
│   ├── auth.js           # Authentication routes
│   ├── summary.js        # Summarization routes
│   ├── debate.js         # Debate/chat routes
│   └── history.js        # User history routes
│
├── services/             # Business logic
│   ├── aiService.js      # AI summarization engine
│   ├── contentExtractor.js # Content extraction
│   ├── pdfProcessor.js   # PDF processing
│   └── urlScraper.js     # URL content scraping
│
├── models/               # Database models
│   ├── User.js
│   ├── Summary.js
│   └── Debate.js
│
├── dashboard.html        # Main application dashboard
├── login.html           # Login page
├── index.html           # Landing page
└── README.md
```

## Features

### 1. Content Summarization
- **URL Summarization:** Paste any news article URL
- **File Upload:** Support for PDF, DOC, DOCX, TXT (max 10MB)
- **Text Input:** Direct text entry for summarization

### 2. AI Debate/Chat
- Interactive chat with AI moderator
- Context-aware responses based on summary content
- Fallback responses when API is unavailable

### 3. User History
- View past summaries
- Quick access to previous content
- Persistent storage via MongoDB

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User authentication |
| `/api/summary/url` | POST | Summarize URL content |
| `/api/summary/text` | POST | Summarize text input |
| `/api/summary/file` | POST | Upload and summarize file |
| `/api/summary/:id` | GET | Get specific summary |
| `/api/debate/create` | POST | Create debate room |
| `/api/debate/send-message` | POST | Send chat message |
| `/api/history/summaries` | GET | Get user summaries |

## Troubleshooting

### Issue: "npm is not recognized"
**Solution:** Node.js is not installed or not in PATH. Reinstall Node.js and restart your terminal.

### Issue: "Cannot connect to MongoDB"
**Solution:** 
- Check if MongoDB is running locally (for local MongoDB)
- Verify the MONGODB_URI in `.env`
- If using MongoDB Atlas, check internet connection
- Check if IP is whitelisted in MongoDB Atlas

### Issue: "Failed to fetch" Error
**This is the most common error when running the frontend and backend on different ports.**

**Symptoms:**
- Login/Register form shows "Failed to fetch" error
- Cannot connect to the API

**Solutions:**

1. **Make sure the backend server is running:**
   ```bash
   npm start
   ```
   You should see: `🚀 Server running on http://localhost:5000`

2. **Make sure MongoDB is running:**
   - For local MongoDB: Start MongoDB service
   - You should see: `✅ MongoDB Connected Successfully`

3. **Verify the frontend is connecting to the correct port:**
   - The frontend (VS Code Live Server) typically runs on port 5500 or 5501
   - The backend runs on port 5000
   - The API_BASE in login.html is set to `http://localhost:5000/api` ✓ (Correct)

4. **CORS should be working now** - We've updated server.js to allow ports 5500 and 5501

### Issue: "Port 5000 already in use"
**Solution:**
- Change PORT in `.env` to another number (e.g., 3000)
- Or kill the process using port 5000

### Issue: "Module not found" errors
**Solution:**
```bash
rm -rf node_modules
npm install
```

## Development Notes

### Code Fixes Applied
1. ✅ Fixed duplicate event listeners in dashboard.html
2. ✅ Added null check for userName to prevent errors
3. ✅ Combined duplicate window.load event listeners
4. ✅ Removed inline onkeypress handler (moved to JavaScript)
5. ✅ Added Escape key handler for logout menu
6. ✅ Fixed CORS configuration to allow ports 5500 and 5501
7. ✅ Added better error handling for "Failed to fetch" errors in login.html

### Security Considerations
- CORS is configured to allow all origins in development
- File uploads are limited to 10MB
- Only PDF, DOC, DOCX, and TXT files are allowed
- User IDs are generated server-side

## Next Steps

1. Install Node.js if not already installed
2. Run `npm install` in the project directory
3. Start the server with `npm start` or `npm run dev`
4. Open http://localhost:5000 in your browser
5. Create an account or login to start using the app

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Ensure all prerequisites are met

---

**Happy summarizing! 📰🤖**