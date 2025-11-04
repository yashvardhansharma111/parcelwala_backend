# Environment Variables Setup Guide

This guide explains how to set up your `.env` file for the Parcel Booking System backend.

## 📋 Required Environment Variables

### 1. Firebase Admin SDK Configuration

**Where to get these:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to the **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file

**Example Firebase service account JSON:**
```json
{
  "type": "service_account",
  "project_id": "my-parcel-booking",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@my-parcel-booking.iam.gserviceaccount.com",
  ...
}
```

**Extract these values:**
- `project_id` → `FIREBASE_PROJECT_ID`
- `client_email` → `FIREBASE_CLIENT_EMAIL`
- `private_key` → `FIREBASE_PRIVATE_KEY` (keep the quotes and `\n` characters)

**In your `.env` file:**
```env
FIREBASE_PROJECT_ID=my-parcel-booking
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@my-parcel-booking.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG...\n-----END PRIVATE KEY-----\n"
```

⚠️ **Important:** The `FIREBASE_PRIVATE_KEY` must be in quotes and keep the `\n` characters as shown.

---

### 2. Renflair SMS API Configuration

Get your API key from [Renflair SMS Gateway](https://renflair.in/sms.php) and add it to your `.env`:

```env
RENFLAIR_API_KEY=your_renflair_api_key_here
RENFLAIR_API_URL=https://sms.renflair.in/V1.php
```

**Note:** The API URL is automatically set to the V1 endpoint for OTP sending. Make sure to add your actual API key from your Renflair account.

---

### 3. JWT Token Configuration

**IMPORTANT:** Generate strong random secrets for production!

**Generate secure secrets (using OpenSSL):**
```bash
# Generate JWT Secret
openssl rand -hex 32

# Generate Refresh Token Secret
openssl rand -hex 32
```

**In your `.env` file:**
```env
JWT_SECRET=your-32-character-hex-string-from-openssl
JWT_REFRESH_SECRET=your-another-32-character-hex-string-from-openssl
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
```

---

### 4. Admin Configuration

Set the phone number that should have admin role:

```env
ADMIN_PHONE_NUMBER=+911234567890
```

**Format:** Country code + number (e.g., `+911234567890` for India)

---

### 5. Server Configuration

```env
PORT=8080
NODE_ENV=development  # Use "production" for production
```

---

## 📝 Complete `.env` File Example

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=my-parcel-booking-project
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc123@my-parcel-booking-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Renflair SMS API (for OTP sending)
RENFLAIR_API_KEY=your_renflair_api_key_here
RENFLAIR_API_URL=https://sms.renflair.in/V1.php

# JWT Secrets (Generate strong random strings!)
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_REFRESH_SECRET=z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1g0f9e8d7c6b5a4
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Admin Phone
ADMIN_PHONE_NUMBER=+911234567890

# Server
PORT=8080
NODE_ENV=development
```

---

## 🔧 Setup Steps

1. **Copy the example file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   - Add your Firebase credentials
   - Generate and add JWT secrets
   - Set admin phone number
   - Configure port (default: 8080)

3. **Verify your setup:**
   ```bash
   npm run dev
   ```

   You should see:
   ```
   🚀 Server is running on port 8080
   📱 Environment: development
   🔗 Health check: http://localhost:8080/health
   ```

---

## 🚨 Security Notes

1. **Never commit `.env` to git** - It's already in `.gitignore`
2. **Use strong JWT secrets** - At least 32 characters, random
3. **Keep Firebase private key secure** - Treat it like a password
4. **Use different secrets for production** - Never use development secrets in production
5. **Restrict Firebase Admin SDK permissions** - Only grant necessary permissions

---

## 🌐 For Koyeb Deployment

When deploying to Koyeb:

1. Go to your Koyeb service → **Settings** → **Environment Variables**
2. Add all variables from your `.env` file
3. For `FIREBASE_PRIVATE_KEY`, paste the entire key including `\n` characters
4. Set `NODE_ENV=production`
5. Set `PORT=8080` (or the port Koyeb provides)

---

## ✅ Quick Checklist

- [ ] Firebase project created
- [ ] Service account key downloaded
- [ ] `FIREBASE_PROJECT_ID` set
- [ ] `FIREBASE_CLIENT_EMAIL` set
- [ ] `FIREBASE_PRIVATE_KEY` set (with quotes and `\n`)
- [ ] `JWT_SECRET` generated and set
- [ ] `JWT_REFRESH_SECRET` generated and set
- [ ] `ADMIN_PHONE_NUMBER` set
- [ ] `.env` file created (not committed to git)
- [ ] Server starts successfully

---

## 🆘 Troubleshooting

**Error: "Firebase credentials not configured"**
- Check that `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are set
- Make sure `FIREBASE_PRIVATE_KEY` has quotes and `\n` characters

**Error: "JWT_SECRET is required"**
- Generate a strong random secret using `openssl rand -hex 32`
- Set it in `.env` file

**Error: "Cannot connect to Firestore"**
- Verify Firebase credentials are correct
- Check that Firestore is enabled in Firebase Console
- Ensure your service account has Firestore permissions

