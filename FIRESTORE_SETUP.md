# 🔥 Firestore Setup Guide

## ❌ Current Error

```
Error: 7 PERMISSION_DENIED: Cloud Firestore API has not been used in project parcelbooking001 before or it is disabled.
```

## ✅ Solution: Enable Firestore API

### Step 1: Enable Firestore API

1. **Go to the activation URL:**
   ```
   https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=parcelbooking001
   ```

2. **Click "Enable"** button

3. **Wait a few minutes** for the API to be enabled (propagation can take 2-5 minutes)

### Step 2: Create Firestore Database

If you haven't created a Firestore database yet:

1. **Go to Firebase Console:**
   ```
   https://console.firebase.google.com/project/parcelbooking001
   ```

2. **Navigate to Firestore Database:**
   - Click on "Firestore Database" in the left sidebar
   - If you see "Get Started", click it

3. **Choose Database Mode:**
   - Select **"Start in production mode"** (we'll configure rules later)
   - Or **"Start in test mode"** for development

4. **Choose Location:**
   - Select a location close to you (e.g., `us-central`, `asia-south1`, `europe-west1`)
   - This cannot be changed later, so choose wisely

5. **Click "Enable"**

### Step 3: Verify Setup

After enabling:

1. **Check Firestore Database exists:**
   - Go to Firestore Database in Firebase Console
   - You should see an empty database

2. **Wait 2-5 minutes** for the API to fully propagate

3. **Restart your backend:**
   ```bash
   # Stop the backend (Ctrl+C)
   # Start again
   npm run dev
   ```

4. **Test again:**
   - Try sending OTP again
   - The user should be created successfully

---

## 🔧 Alternative: Enable via Google Cloud Console

1. **Go to Google Cloud Console:**
   ```
   https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=parcelbooking001
   ```

2. **Click "Enable"**

3. **Wait for confirmation**

---

## 📋 Quick Checklist

- [ ] Firestore API enabled in Google Cloud Console
- [ ] Firestore Database created in Firebase Console
- [ ] Database location selected
- [ ] Waited 2-5 minutes for propagation
- [ ] Backend restarted
- [ ] Tested OTP flow again

---

## 🚨 Common Issues

### Issue: "API enabled but still getting error"

**Solution:**
- Wait a few more minutes (can take up to 5 minutes)
- Restart your backend server
- Verify you're using the correct project ID (`parcelbooking001`)

### Issue: "Database not found"

**Solution:**
- Make sure you created the database in Firebase Console
- Check that you selected a location
- Verify the project ID matches in Firebase Console and your backend `.env`

### Issue: "Permission denied" after enabling

**Solution:**
- Check that your service account has Firestore permissions
- Verify service account email in `.env` matches the one in Firebase Console
- Regenerate service account key if needed

---

## 🔐 Firestore Security Rules (Development)

For development, you can use test mode rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 1, 1);
    }
  }
}
```

**For production**, you'll want proper security rules based on authentication.

---

## ✅ Verification

After setup, you should see in your backend logs:
```
✅ Firebase connected successfully: parcelbooking001
```

And when creating a user:
```
User created/fetched successfully: user-id-123
```

Instead of:
```
Error creating/getting user: PERMISSION_DENIED
```

---

**Quick Fix**: Just click the link below and enable the API:
👉 https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=parcelbooking001

Then create the Firestore database in Firebase Console if you haven't already!


