# Vercel Environment Variables Setup Guide

## 🚨 Common Issue: Environment Variables Not Loading in Vercel

If you're getting "Paygic credentials not configured" error in Vercel production, follow these steps:

## ✅ Step-by-Step Setup

### 1. Go to Vercel Dashboard

1. Visit [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**

### 2. Add Environment Variables

**IMPORTANT:** Add each variable individually. Don't upload a `.env` file directly.

Click **Add New** for each variable:

#### Required Variables:

```
PAYGIC_MID
Value: your_merchant_id_here
Environment: Production, Preview, Development (select all)

PAYGIC_TOKEN
Value: your_paygic_token_here
Environment: Production, Preview, Development (select all)

PAYGIC_BASE_URL
Value: https://server.paygic.in/api/v2
Environment: Production, Preview, Development (select all)

PAYGIC_SUCCESS_URL
Value: https://your-vercel-app.vercel.app/api/payments/webhook
Environment: Production, Preview, Development (select all)

PAYGIC_FAILED_URL
Value: https://your-vercel-app.vercel.app/api/payments/webhook
Environment: Production, Preview, Development (select all)

RENFLAIR_API_KEY
Value: your_renflair_api_key_here
Environment: Production, Preview, Development (select all)
```

### 3. Verify Variable Names

**CRITICAL:** Make sure variable names are EXACTLY:
- `PAYGIC_MID` (not `PAYGIC_Mid` or `paygic_mid`)
- `PAYGIC_TOKEN` (not `PAYGIC_Token` or `paygic_token`)
- All uppercase with underscores

### 4. Redeploy After Adding Variables

After adding environment variables:
1. Go to **Deployments** tab
2. Click on the latest deployment
3. Click **Redeploy** (or trigger a new deployment)

**Environment variables are only available after redeployment!**

## 🔍 Troubleshooting

### Check if Variables are Loaded

After deployment, check your Vercel function logs:
1. Go to **Deployments** → Click on a deployment
2. Click **Functions** tab
3. Check logs for environment variable status messages

You should see:
```
✅ Environment loaded for: production
🔐 Paygic MID configured: Yes
🔐 Paygic Token configured: Yes
```

### Common Mistakes

1. **Wrong Variable Names:**
   - ❌ `PAYGIC_Token` (wrong case)
   - ❌ `paygic_mid` (wrong case)
   - ✅ `PAYGIC_TOKEN` (correct)
   - ✅ `PAYGIC_MID` (correct)

2. **Not Redeploying:**
   - Variables only take effect after redeployment
   - Always redeploy after adding/modifying variables

3. **Wrong Environment Selected:**
   - Make sure variables are added for **Production** environment
   - Check the environment dropdown when adding variables

4. **Extra Spaces:**
   - Don't add spaces before/after the value
   - Copy-paste values carefully

### Verify in Code

The code now logs environment variable status. Check your Vercel logs to see:
- Which variables are configured
- Which variables are missing

## 📝 Quick Checklist

- [ ] All variable names are uppercase with underscores
- [ ] Variables added for Production environment
- [ ] Redeployed after adding variables
- [ ] Checked Vercel logs for confirmation
- [ ] Tested payment flow in production

## 🔧 If Still Not Working

1. **Check Vercel Logs:**
   - Go to deployment → Functions → View logs
   - Look for environment variable status messages

2. **Verify Variable Values:**
   - Make sure values are correct (no extra spaces)
   - Verify API keys are valid

3. **Check Function Execution:**
   - Ensure the function is actually running
   - Check if there are any build errors

4. **Contact Support:**
   - If issue persists, check Vercel documentation
   - Verify your Vercel plan supports environment variables




