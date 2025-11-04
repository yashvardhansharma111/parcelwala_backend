# 🔥 Firestore Security Rules Setup

## ⚠️ Current Warnings

The warnings you're seeing:
```
@firebase/firestore: Firestore (10.14.1): WebChannelConnection RPC 'Listen' stream transport errored
```

These are from **Firestore real-time listeners** trying to subscribe to booking updates. The warnings occur because:

1. **Firestore Security Rules** are not configured or are blocking access
2. **Firestore API** might still be propagating (wait a few minutes)
3. **Network connectivity** issues with Firestore

## ✅ Solution: Configure Firestore Security Rules

### Step 1: Go to Firestore Rules

1. **Go to Firebase Console:**
   ```
   https://console.firebase.google.com/project/parcelbooking001/firestore/rules
   ```

2. **Click on "Firestore Database" → "Rules" tab**

### Step 2: Update Security Rules

**For Development (Test Mode):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access for development (30 days)
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 2, 1);
    }
  }
}
```

**For Production (Recommended):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Bookings collection
    match /bookings/{bookingId} {
      // Users can read their own bookings
      allow read: if request.auth != null && 
                     (resource.data.userId == request.auth.uid || 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
      
      // Users can create their own bookings
      allow create: if request.auth != null && 
                       request.resource.data.userId == request.auth.uid;
      
      // Users can update their own bookings (status updates)
      allow update: if request.auth != null && 
                        (resource.data.userId == request.auth.uid ||
                         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }
    
    // Settings collection (admin only)
    match /settings/{settingId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
                      get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Step 3: Publish Rules

1. **Click "Publish"** after updating rules
2. **Wait 1-2 minutes** for rules to propagate

---

## 🔧 Current Architecture Issue

**Note:** Your app uses **Firebase Admin SDK** on the backend and **Firebase Client SDK** on the frontend. This means:

- **Backend**: Uses service account (bypasses security rules)
- **Frontend**: Uses client SDK (must follow security rules)

Since you're using **custom backend API** for authentication, the frontend might not have Firebase Auth tokens. This causes the security rules to block access.

---

## 🎯 Quick Fix Options

### Option 1: Use Test Mode Rules (Development Only)

Temporarily allow all access for development:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // Allow all access (DEV ONLY!)
    }
  }
}
```

**⚠️ WARNING:** This allows anyone to read/write. **Only use for development!**

### Option 2: Disable Real-time Listeners (Temporary)

If the warnings are annoying, you can disable real-time listeners and use polling instead.

### Option 3: Fix Authentication Flow

Since you're using custom backend API, the frontend needs to authenticate with Firebase separately, OR you need to:

1. Use **backend API** for booking operations instead of direct Firestore
2. Only use Firestore on frontend for reading public data
3. Have backend handle all writes

---

## 📋 Quick Checklist

- [ ] Go to Firebase Console → Firestore → Rules
- [ ] Update rules (use test mode for now)
- [ ] Click "Publish"
- [ ] Wait 1-2 minutes
- [ ] Restart your app
- [ ] Check if warnings are gone

---

## 🔍 Why These Warnings?

The warnings occur because:

1. **Real-time listeners** (`onSnapshot`) are trying to connect to Firestore
2. **Security rules** are blocking access (or not configured)
3. **No Firebase Auth token** on the frontend (since you use custom backend auth)
4. **Listen streams** fail because of permission issues

---

## 💡 Long-term Solution

Consider migrating booking operations to use your **backend API** instead of direct Firestore access:

1. Create booking API endpoints in backend
2. Frontend calls backend API for booking CRUD
3. Backend handles Firestore operations
4. Remove direct Firestore access from frontend

This gives you:
- ✅ Better security control
- ✅ Consistent authentication (JWT tokens)
- ✅ No Firestore security rules issues
- ✅ Centralized business logic

---

**Quick Fix**: For now, use test mode rules in Firestore to allow access and remove the warnings.


