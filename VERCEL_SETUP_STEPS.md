# Vercel Dashboard Setup - Step by Step

## Step 1: Add New Project in Vercel

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Find and select your `newsmind.ai` repository
4. Click **"Import"**

## Step 2: Configure Project Settings

Fill in these exact settings:

### Basic Settings
- **Project Name**: `newsmind-ai` (or your preferred name)
- **Framework Preset**: Select **"Other"**
- **Root Directory**: `./` (leave as default)

### Build & Output Settings
- **Build Command**: Leave empty (or enter `echo "Build complete"`)
- **Output Directory**: Leave empty
- **Install Command**: `npm install`

### Environment Variables
Click **"Environment Variables"** and add these:

| Name | Value | Environment |
|------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/newsmind?retryWrites=true&w=majority` | Production ✓, Preview ✓, Development ✓ |
| `GEMINI_API_KEY` | `your_actual_gemini_api_key` | Production ✓, Preview ✓, Development ✓ |
| `NODE_ENV` | `production` | Production ✓ |

**Important**: 
- Replace `your_username`, `your_password`, and `cluster0.xxxxx` with your actual MongoDB Atlas credentials
- Make sure to URL-encode special characters in password (e.g., `@` becomes `%40`)

## Step 3: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (1-3 minutes)
3. You should see **"Congratulations!"** message

## Step 4: Verify Deployment

1. Click the deployed URL (e.g., `https://newsmind-ai.vercel.app`)
2. Visit the health endpoint: `https://your-url.vercel.app/`
3. You should see:
```json
{
  "status": "success",
  "message": "News AI Summarizer API is running!",
  "database": "MongoDB",
  "dbStatus": "connected"
}
```

## Step 5: Add Custom Domain (Optional)

1. In Vercel dashboard, go to **"Settings"** → **"Domains"**
2. Enter your domain: `newsmind.ai`
3. Follow Vercel's DNS configuration instructions
4. Add these records to your domain registrar:
   - Type: `A`, Name: `@`, Value: `76.76.21.21`
   - Type: `CNAME`, Name: `www`, Value: `cname.vercel-dns.com`

## Troubleshooting

### If build fails:
1. Check **"Deployments"** tab → Click the failed deployment
2. View **"Build Logs"** to see the error
3. Common fixes:
   - Ensure `package.json` has `