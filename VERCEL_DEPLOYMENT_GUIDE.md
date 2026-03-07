# Vercel Deployment Guide - MongoDB Migration

This guide explains how to deploy the NewsMind AI application to Vercel using MongoDB Atlas (serverless-compatible database).

## 🚨 Problem Solved

The original SQLite3 dependency with native C++ bindings is incompatible with Vercel's serverless environment. This migration replaces SQLite with MongoDB Atlas, which is fully compatible with serverless deployments.

## 📋 Prerequisites

1. **MongoDB Atlas Account**: Sign up at [https://www.mongodb.com/atlas](https://www.mongodb.com/atlas)
2. **Vercel Account**: Sign up at [https://vercel.com](https://vercel.com)
3. **Git Repository**: Code pushed to GitHub/GitLab/Bitbucket

---

## 🔧 Step 1: Set Up MongoDB Atlas

### 1.1 Create a Cluster
1. Log in to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click "Build a New Cluster" (or "Create" if you have no clusters)
3. Choose the **M0 (Free Tier)** for development
4. Select your preferred cloud provider and region (choose one close to your users)
5. Click "Create Cluster" (takes 1-3 minutes)

### 1.2 Configure Database Access
1. In the left sidebar, click **"Database Access"**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter a username and password (save these securely!)
5. Under **"Database User Privileges"**, select **"Read and write to any database"**
6. Click **"Add User"**

### 1.3 Configure Network Access
1. In the left sidebar, click **"Network Access"**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0) for Vercel deployment
   - ⚠️ For production, consider using Vercel's IP ranges for better security
4. Click **"Confirm"**

### 1.4 Get Your Connection String
1. Click **"Database"** in the left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select **"Node.js"** and copy the connection string

The connection string looks like:
```
mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/newsmind?retryWrites=true&w=majority
```

---

## 🔧 Step 2: Configure Vercel Environment Variables

### 2.1 Add Environment Variables in Vercel Dashboard

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Settings"** tab
3. Click **"Environment Variables"** in the left sidebar
4. Add the following variables:

#### Required Variables

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `MONGODB_URI` | Your MongoDB connection string | Production, Preview, Development |
| `GEMINI_API_KEY` | Your Google Gemini API key | Production, Preview, Development |
| `NODE_ENV` | `production` | Production |

#### Optional Variables (Depending on Features Used)

| Variable Name | Description |
|--------------|-------------|
| `GROQ_API_KEY` | For Groq AI service |
| `OPENAI_API_KEY` | For OpenAI service |
| `COHERE_API_KEY` | For Cohere AI service |
| `GOOGLE_CLOUD_API_KEY` | For Google Text-to-Speech |

### 2.2 Format for MONGODB_URI
Replace the placeholders in your connection string:

```
mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/newsmind?retryWrites=true&w=majority
```

**Important**: 
- Replace `your_username` and `your_password` with your actual credentials
- The database name `newsmind` will be created automatically on first connection

---

## 🔧 Step 3: Deploy to Vercel

### 3.1 Import Project
1. In Vercel Dashboard, click **"Add New..."** → **"Project"**
2. Import your Git repository
3. Select the repository with your code

### 3.2 Configure Project Settings

**Build & Output Settings:**
- **Framework Preset**: `Other`
- **Build Command**: Leave empty (or `npm run vercel-build`)
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

**Root Directory:**
- Make sure it's set to the root where `api/index.js` is located

### 3.3 Deploy
1. Click **"Deploy"**
2. Wait for the build to complete (should take 1-2 minutes)
3. Once deployed, Vercel will provide you with a URL like `https://your-project.vercel.app`

---

## 🔧 Step 4: Verify Deployment

### 4.1 Check Health Endpoint
Visit your deployment URL:
```
https://your-project.vercel.app/
```

You should see:
```json
{
  "status": "success",
  "message": "News AI Summarizer API is running!",
  "version": "1.0.0",
  "database": "MongoDB",
  "dbStatus": "connected",
  "realtime": "Serverless mode (Socket.io disabled)"
}
```

### 4.2 Test API Endpoints
Test a simple endpoint:
```bash
curl https://your-project.vercel.app/api/summary/trending
```

---

## 📁 Files Changed in This Migration

### Database Configuration
- ✅ `config/database.js` - Now uses MongoDB/Mongoose instead of SQLite/Sequelize

### Models (Converted from Sequelize to Mongoose)
- ✅ `models/User.js` - Mongoose schema
- ✅ `models/Summary.js` - Mongoose schema  
- ✅ `models/Debate.js` - Mongoose schema with embedded documents
- ✅ `models/Poll.js` - Mongoose schema

### API Entry Point
- ✅ `api/index.js` - Added MongoDB connection handling for serverless
- ✅ `server.js` - Updated for MongoDB connection

### Routes (Updated Query Syntax)
- ✅ `routes/auth.js` - Mongoose queries
- ✅ `routes/summary.js` - Mongoose queries
- ✅ `routes/debate.js` - Mongoose queries with embedded documents
- ✅ `routes/history.js` - Mongoose queries with aggregation
- ✅ `routes/polls.js` - Mongoose queries
- ✅ `routes/factcheck.js` - Mongoose queries

### Configuration
- ✅ `package.json` - Removed `sqlite3` and `sequelize`, updated `mongoose`
- ✅ `vercel.json` - Optimized for serverless with proper build settings

---

## 🔍 Troubleshooting

### Issue: "MONGODB_URI not set"
**Solution**: 
- Check that the environment variable is set in Vercel Dashboard
- Ensure it's added to the correct environment (Production/Preview/Development)
- Redeploy after adding the variable

### Issue: "Cannot connect to MongoDB"
**Solution**:
1. Check Network Access in MongoDB Atlas - allow access from anywhere (0.0.0.0/0)
2. Verify the connection string format
3. Ensure username/password are URL-encoded if they contain special characters

### Issue: "Module not found: sqlite3"
**Solution**:
- This migration removes sqlite3. If you see this error:
1. Delete `node_modules` folder
2. Delete `package-lock.json`
3. Run `npm install` again
4. Push to Git and redeploy

### Issue: "Query failed" or "CastError"
**Solution**:
- MongoDB uses `_id` instead of `id`
- In Mongoose, use `findById()` instead of `findByPk()`
- Use `new mongoose.Types.ObjectId(string)` when converting string IDs

---

## 🔄 Local Development

### With MongoDB Atlas (Recommended)
1. Create a `.env` file in your project root:
```env
MONGODB_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/newsmind?retryWrites=true&w=majority
GEMINI_API_KEY=your_gemini_api_key
NODE_ENV=development
```

2. Run locally:
```bash
npm install
npm run dev
```

### With Local MongoDB
1. Install MongoDB locally: [https://docs.mongodb.com/manual/installation/](https://docs.mongodb.com/manual/installation/)
2. Update `.env`:
```env
MONGODB_URI=mongodb://localhost:27017/newsmind
```

---

## 🚀 Performance Optimizations

### Database Indexes
The following indexes are automatically created for optimal performance:

- **User**: `userId` (unique), `lastActive`
- **Summary**: `userId + createdAt`, `topics`, `createdAt`
- **Debate**: `roomId` (unique), `status`, `lastActivity`, `participants`
- **Poll**: `summaryId`, `userId`, `status`

### Serverless Optimizations
1. **Connection Pooling**: MongoDB connection is cached between function invocations
2. **Lazy Connection**: Database connects on first request, not on cold start
3. **Selective Fields**: Queries exclude large fields like `originalContent` when not needed

---

## 📊 Monitoring

### Vercel Dashboard
- View function invocations and errors
- Monitor response times
- Check build logs

### MongoDB Atlas Dashboard
- Monitor database connections
- View slow queries
- Track storage usage

---

## 🔒 Security Best Practices

1. **Never commit `.env` files** to Git
2. **Use strong passwords** for MongoDB Atlas
3. **Restrict IP access** in MongoDB Atlas for production
4. **Enable MongoDB Atlas backups** for production clusters
5. **Use Vercel's built-in DDoS protection**

---

## 📝 Additional Notes

### Limitations of Serverless Deployment
1. **Socket.io is disabled** in serverless mode (stateless functions)
2. **File uploads** are limited to memory (no persistent storage)
3. **Function timeout** is 30 seconds (configurable up to 300s on paid plans)

### For Full Socket.io Support
Consider deploying the server separately on a platform that supports WebSockets:
- Railway.app
- Render.com
- AWS EC2
- Digital Ocean Droplets

---

## ✅ Deployment Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with read/write permissions
- [ ] Network access configured (0.0.0.0/0 for Vercel)
- [ ] Connection string copied
- [ ] Vercel project created
- [ ] Environment variables added in Vercel Dashboard
- [ ] Project deployed successfully
- [ ] Health endpoint returns success
- [ ] API endpoints tested

---

## 🆘 Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check MongoDB Atlas metrics
3. Verify environment variables are set correctly
4. Test locally with the same MongoDB URI

---

**You're now ready to deploy NewsMind AI to Vercel with MongoDB! 🎉**