# Vercel Deployment Guide

This guide explains how to deploy the Parcel Booking Backend to Vercel.

## ✅ Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI** (optional): `npm i -g vercel`
3. **Git Repository**: Your code should be in a Git repository (GitHub, GitLab, or Bitbucket)

## 📋 Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"

2. **Import Your Repository**
   - Connect your Git repository
   - Select the repository containing your backend

3. **Configure Project**
   - **Root Directory**: Set to `backend` (if your backend is in a subdirectory)
   - **Framework Preset**: Select "Other"
   - **Build Command**: `npm run build` or `npm run vercel-build`
   - **Output Directory**: Leave empty (Vercel handles this)
   - **Install Command**: `npm install`

4. **Environment Variables**
   - Add all environment variables from your `.env` file:
     ```
     FIREBASE_PROJECT_ID=your_project_id
     FIREBASE_CLIENT_EMAIL=your_client_email
     FIREBASE_PRIVATE_KEY=your_private_key
     RENFLAIR_API_KEY=your_api_key
     RENFLAIR_API_URL=https://sms.renflair.in/V1.php
     JWT_SECRET=your_jwt_secret
     JWT_REFRESH_SECRET=your_refresh_secret
     PAYGIC_MID=your_paygic_mid
     PAYGIC_TOKEN=your_paygic_token
     PAYGIC_BASE_URL=https://server.paygic.in/api/v2
     PAYGIC_SUCCESS_URL=https://your-domain.com/payment/success
     PAYGIC_FAILED_URL=https://your-domain.com/payment/failed
     ADMIN_PHONE_NUMBER=+911234567890
     ```

5. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete

### Option 2: Deploy via Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Navigate to Backend Directory**
   ```bash
   cd backend
   ```

3. **Login to Vercel**
   ```bash
   vercel login
   ```

4. **Deploy**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Select your project settings
   - Add environment variables when prompted

5. **Deploy to Production**
   ```bash
   vercel --prod
   ```

## 🔧 Configuration Files

The following files are configured for Vercel:

- **`vercel.json`**: Vercel configuration
- **`api/index.ts`**: Serverless function entry point
- **`.vercelignore`**: Files to exclude from deployment

## 📝 Important Notes

### 1. Environment Variables

All environment variables must be set in Vercel Dashboard:
- Go to Project Settings → Environment Variables
- Add each variable for Production, Preview, and Development environments

### 2. Firebase Private Key

When adding `FIREBASE_PRIVATE_KEY` in Vercel:
- Keep the `\n` characters in the key
- The entire key should be in quotes in your `.env`, but in Vercel, just paste the raw key value

### 3. API Routes

After deployment, your API will be available at:
- `https://your-project.vercel.app/api/*`
- Example: `https://your-project.vercel.app/api/auth/send-otp`

### 4. Health Check

Test your deployment:
```
https://your-project.vercel.app/health
```

### 5. Static Files

The `ratlam-addresses.json` file is included in the deployment. If you need to update it:
- Update the file in your repository
- Redeploy to Vercel

## 🔄 Updating Frontend API URL

After deployment, update your frontend API client to use the Vercel URL:

```typescript
// In parcelbooking/services/apiClient.ts
const API_BASE_URL = __DEV__ 
  ? "http://localhost:8080" 
  : "https://your-project.vercel.app";
```

## 🐛 Troubleshooting

### Build Errors

1. **TypeScript Errors**: Ensure all TypeScript errors are fixed before deploying
2. **Missing Dependencies**: Check that all dependencies are in `package.json`

### Runtime Errors

1. **Environment Variables**: Verify all environment variables are set correctly
2. **Firebase Initialization**: Check Firebase credentials are correct
3. **Function Timeout**: Vercel has a 10-second timeout for free tier. Consider upgrading for longer-running operations

### API Not Working

1. **CORS Issues**: The CORS configuration in `app.ts` allows all origins. Adjust if needed
2. **Route Not Found**: Check that routes are correctly prefixed with `/api` if needed

## 📊 Monitoring

- **Vercel Dashboard**: View logs, analytics, and function invocations
- **Function Logs**: Check real-time logs in Vercel Dashboard → Functions

## 🔒 Security Recommendations

1. **Never commit `.env` files** to Git
2. **Use Vercel Environment Variables** for all secrets
3. **Enable Vercel Authentication** if needed
4. **Review API rate limits** and implement rate limiting if necessary

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)
- [Environment Variables](https://vercel.com/docs/environment-variables)

