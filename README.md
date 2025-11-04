# Parcel Booking System - Backend API

Production-ready Express.js backend for the Parcel Booking System.

## 🚀 Features

- **OTP Authentication** - SMS-based login using Renflair API
- **JWT Tokens** - Access and refresh token implementation
- **Firebase Firestore** - Database for users and bookings
- **NodeCache** - In-memory OTP storage (5-minute expiry)
- **Role-based Access** - Admin and customer roles
- **TypeScript** - Type-safe codebase

## 📋 Prerequisites

- Node.js (v18+)
- Firebase project with Firestore enabled
- Firebase Admin SDK service account
- Renflair SMS API access

## 🔧 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required environment variables:

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT Secrets (change in production!)
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-super-refresh-secret

# Admin Phone
ADMIN_PHONE_NUMBER=+911234567890

# Server
PORT=8080
NODE_ENV=production
```

### 3. Get Firebase Admin SDK Credentials

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Extract `project_id`, `client_email`, and `private_key` from the JSON
5. Add them to `.env` (for private_key, keep the quotes and `\n` characters)

### 4. Build and Run

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

Server will start on `http://localhost:8080` (or PORT from .env)

## 📡 API Endpoints

### Authentication

#### `POST /auth/send-otp`
Send OTP to phone number.

**Request:**
```json
{
  "phoneNumber": "+911234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

#### `POST /auth/verify-otp`
Verify OTP and get tokens.

**Request:**
```json
{
  "phoneNumber": "+911234567890",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "userId",
      "phoneNumber": "+911234567890",
      "role": "customer",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `POST /auth/refresh`
Refresh access token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### `POST /auth/logout`
Logout and invalidate refresh token.

**Request:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### User Routes (Protected)

#### `GET /user/profile`
Get user profile.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "userId",
      "phoneNumber": "+911234567890",
      "role": "customer",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### Admin Routes (Protected)

#### `GET /admin/dashboard`
Get admin dashboard data.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Admin dashboard data",
    "user": {
      "id": "userId",
      "phoneNumber": "+911234567890",
      "role": "admin"
    }
  }
}
```

## 🏗️ Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── services/        # Business logic
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth & role middleware
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   ├── app.ts           # Express app setup
│   └── server.ts        # Entry point
├── .env                 # Environment variables
├── package.json
└── README.md
```

## 🔒 Security Notes

1. **Change JWT secrets** in production environment
2. **Use strong secrets** for JWT_SECRET and JWT_REFRESH_SECRET
3. **Keep .env file secure** - never commit it to git
4. **Use HTTPS** in production
5. **Validate all inputs** on client and server side

## 🚢 Deployment (Koyeb)

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Set environment variables** in Koyeb dashboard:
   - All variables from `.env.example`

3. **Deploy:**
   - Connect your GitHub repository
   - Set build command: `npm run build`
   - Set start command: `npm start`
   - Set port: `8080` (or your PORT env variable)

4. **Environment Variables in Koyeb:**
   - Go to your service → Settings → Environment Variables
   - Add all required variables from `.env.example`

## 📝 API Integration with React Native App

Update your React Native app's `config/index.ts`:

```typescript
export const AppConfig = {
  // ... existing config
  api: {
    baseUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080",
  },
};
```

Then update `services/authService.ts` to call the backend API instead of Firebase Auth directly.

## 🐛 Error Handling

All errors return consistent format:

```json
{
  "success": false,
  "error": {
    "message": "Error message here"
  }
}
```

## 📄 License

Private and proprietary.

