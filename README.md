# NewsMind AI - Geopolitical Intelligence Platform

A high-performance news analysis platform using Google Gemini, Groq, and Serper.dev for deep forensic intelligence gathering.

## 🚀 Quick Start (Local)

1. `npm install`
2. Configure `.env` with your API keys.
3. `npm start` (Runs on http://localhost:5000)

## ☁️ Deployment (Render + Firebase)

This project is optimized for deployment on **Render** (for the backend/frontend logic) using **Firebase Firestore** as the database.

### 1. Firebase Setup
- Enable **Firestore** in the Firebase Console.
- Generate a **Service Account Key** (Project Settings > Service Accounts).
- Copy the entire JSON content.

### 2. Render Deployment
1. Connect this repository to a new **Web Service** on Render.
2. Set **Build Command**: `npm install`
3. Set **Start Command**: `node server.js`
4. Add the following **Environment Variables**:

| Key | Value Template |
| :--- | :--- |
| `FIREBASE_SERVICE_ACCOUNT` | (Paste full JSON string from step 1) |
| `GEMINI_API_KEY` | (Your Key) |
| `GROQ_API_KEY` | (Your Key) |
| `SERPER_API_KEY` | (Your Key) |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://your-custom-domain.com,https://your-app.onrender.com` |

## 🛡️ Security Features
- **CSP Headers**: Hardened Content Security Policy.
- **CORS**: Domain-specific whitelisting.
- **Circuit Breaker**: AI provider failover logic.
- **Rate Limiting**: Protection against brute-force and AI resource exhaustion.

## ⚖️ License
MIT
