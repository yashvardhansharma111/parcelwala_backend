# 📚 Parcel Booking System - API Documentation

Complete API documentation for the Parcel Booking System backend.

---

## 🌐 Base URL

```
Development: http://localhost:8080
Production: https://your-domain.com
```

---

## 🔐 Authentication

The API uses **JWT (JSON Web Tokens)** for authentication with two token types:

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to get new access tokens

### Authentication Flow

1. **Send OTP** → User receives 6-digit OTP via SMS
2. **Verify OTP** → Get access token + refresh token
3. **Use Access Token** → Include in `Authorization` header for protected routes
4. **Refresh Token** → When access token expires, use refresh token to get a new one
5. **Logout** → Invalidate refresh token

### Using Access Token

Include the access token in the `Authorization` header:

```http
Authorization: Bearer <your-access-token>
```

**Example:**
```http
GET /user/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📋 API Endpoints

### 1. Health Check

Check if the server is running.

**Endpoint:** `GET /health`

**Authentication:** None

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### 2. Send OTP

Send a 6-digit OTP to the provided phone number via SMS.

**Endpoint:** `POST /auth/send-otp`

**Authentication:** None

**Request Body:**
```json
{
  "phoneNumber": "+911234567890"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phoneNumber | string | Yes | Phone number with country code (e.g., `+911234567890`) |

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "message": "Phone number is required"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid phone number format"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+911234567890"
  }'
```

---

### 3. Verify OTP

Verify the OTP and get access + refresh tokens.

**Endpoint:** `POST /auth/verify-otp`

**Authentication:** None

**Request Body:**
```json
{
  "phoneNumber": "+911234567890",
  "otp": "123456"
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| phoneNumber | string | Yes | Phone number (same as sent OTP) |
| otp | string | Yes | 6-digit OTP code |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id-123",
      "phoneNumber": "+911234567890",
      "role": "customer",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "message": "Phone number is required"
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "message": "Valid 6-digit OTP is required"
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid or expired OTP"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+911234567890",
    "otp": "123456"
  }'
```

**Note:** 
- If user doesn't exist, a new user will be created
- Role is determined by phone number (admin phone number = admin role, others = customer)

---

### 4. Create Booking

Create a new parcel booking.

**Endpoint:** `POST /bookings`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "pickup": {
    "name": "John Doe",
    "phone": "+911234567890",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001",
    "landmark": "Near City Mall"
  },
  "drop": {
    "name": "Jane Smith",
    "phone": "+919876543210",
    "address": "456 Park Avenue",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "landmark": "Opposite Metro Station"
  },
  "parcelDetails": {
    "type": "Documents",
    "weight": 0.5,
    "dimensions": {
      "length": 30,
      "width": 20,
      "height": 5
    },
    "description": "Important documents",
    "value": 1000
  },
  "fare": 150
}
```

**Response (Success - 201):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "booking-id-123",
      "userId": "user-id-123",
      "pickup": { ... },
      "drop": { ... },
      "parcelDetails": { ... },
      "status": "Created",
      "paymentStatus": "pending",
      "fare": 150,
      "trackingNumber": "PBS-ABC123XYZ",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{
    "pickup": { ... },
    "drop": { ... },
    "parcelDetails": { ... }
  }'
```

---

### 5. Get User's Bookings

Get all bookings for the authenticated user.

**Endpoint:** `GET /bookings`

**Authentication:** Required (Bearer token)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "booking-id-123",
        "userId": "user-id-123",
        "pickup": { ... },
        "drop": { ... },
        "parcelDetails": { ... },
        "status": "Created",
        "paymentStatus": "pending",
        "fare": 150,
        "trackingNumber": "PBS-ABC123XYZ",
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8080/bookings \
  -H "Authorization: Bearer <your-access-token>"
```

---

### 6. Get Booking by ID

Get a specific booking by ID.

**Endpoint:** `GET /bookings/:id`

**Authentication:** Required (Bearer token)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "booking-id-123",
      "userId": "user-id-123",
      "pickup": { ... },
      "drop": { ... },
      "parcelDetails": { ... },
      "status": "Created",
      "paymentStatus": "pending",
      "fare": 150,
      "trackingNumber": "PBS-ABC123XYZ",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "error": {
    "message": "Booking not found"
  }
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8080/bookings/booking-id-123 \
  -H "Authorization: Bearer <your-access-token>"
```

---

### 7. Update Booking Status

Update the status of a booking (e.g., Created → Picked → Shipped → Delivered).

**Endpoint:** `PATCH /bookings/:id/status`

**Authentication:** Required (Bearer token)

**Request Body:**
```json
{
  "status": "Picked"
}
```

**Valid Statuses:** `"Created"`, `"Picked"`, `"Shipped"`, `"Delivered"`

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "booking-id-123",
      "status": "Picked",
      ...
    }
  }
}
```

**cURL Example:**
```bash
curl -X PATCH http://localhost:8080/bookings/booking-id-123/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-access-token>" \
  -d '{
    "status": "Picked"
  }'
```

---

### 8. Get All Bookings (Admin)

Get all bookings with optional filters (Admin only).

**Endpoint:** `GET /bookings/admin/all`

**Authentication:** Required (Bearer token, Admin role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by booking status |
| paymentStatus | string | No | Filter by payment status |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "booking-id-123",
        "userId": "user-id-123",
        ...
      }
    ]
  }
}
```

**cURL Example:**
```bash
curl -X GET "http://localhost:8080/bookings/admin/all?status=Created&paymentStatus=pending" \
  -H "Authorization: Bearer <admin-access-token>"
```

---

### 9. Update Payment Status (Admin)

Update the payment status of a booking (Admin only).

**Endpoint:** `PATCH /bookings/:id/payment-status`

**Authentication:** Required (Bearer token, Admin role)

**Request Body:**
```json
{
  "paymentStatus": "paid"
}
```

**Valid Payment Statuses:** `"pending"`, `"paid"`, `"failed"`, `"refunded"`

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "booking": {
      "id": "booking-id-123",
      "paymentStatus": "paid",
      ...
    }
  }
}
```

**cURL Example:**
```bash
curl -X PATCH http://localhost:8080/bookings/booking-id-123/payment-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin-access-token>" \
  -d '{
    "paymentStatus": "paid"
  }'
```

---

### 4. Refresh Access Token

Get a new access token using the refresh token.

**Endpoint:** `POST /auth/refresh`

**Authentication:** None (but requires valid refresh token)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| refreshToken | string | Yes | Valid refresh token |

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "message": "Refresh token is required"
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "message": "Invalid refresh token"
  }
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "error": {
    "message": "User not found"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token-here"
  }'
```

**Note:**
- Refresh token must match the one stored in Firestore
- New access token expires in 15 minutes
- Refresh token remains valid for 7 days

---

### 5. Logout

Invalidate the refresh token (logout).

**Endpoint:** `POST /auth/logout`

**Authentication:** None (but requires valid refresh token)

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Request Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| refreshToken | string | Yes | Refresh token to invalidate |

**Response (Success):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "error": {
    "message": "Refresh token is required"
  }
}
```

**cURL Example:**
```bash
curl -X POST http://localhost:8080/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token-here"
  }'
```

**Note:**
- Even if the refresh token is invalid/expired, logout will return success
- After logout, the refresh token cannot be used to get new access tokens

---

### 6. Get User Profile

Get the authenticated user's profile information.

**Endpoint:** `GET /user/profile`

**Authentication:** Required (Access Token)

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-id-123",
      "phoneNumber": "+911234567890",
      "role": "customer",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "message": "Authorization token missing"
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "message": "Authentication failed"
  }
}
```

**Response (Error - 404):**
```json
{
  "success": false,
  "error": {
    "message": "User not found"
  }
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8080/user/profile \
  -H "Authorization: Bearer your-access-token-here"
```

**Note:**
- Refresh token is excluded from the response
- Both admin and customer roles can access this endpoint

---

### 7. Get Admin Dashboard

Get admin dashboard data (admin only).

**Endpoint:** `GET /admin/dashboard`

**Authentication:** Required (Access Token)

**Authorization:** Admin role required

**Headers:**
```http
Authorization: Bearer <access-token>
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Admin dashboard data",
    "user": {
      "id": "admin-id-123",
      "phoneNumber": "+911234567890",
      "role": "admin"
    }
  }
}
```

**Response (Error - 401):**
```json
{
  "success": false,
  "error": {
    "message": "Authorization token missing"
  }
}
```

**Response (Error - 403):**
```json
{
  "success": false,
  "error": {
    "message": "Admin access required"
  }
}
```

**cURL Example:**
```bash
curl -X GET http://localhost:8080/admin/dashboard \
  -H "Authorization: Bearer your-admin-access-token-here"
```

**Note:**
- Only users with `role: "admin"` can access this endpoint
- This is a placeholder endpoint - implement dashboard logic as needed

---

## 🔄 Complete Authentication Flow Example

### Step 1: Send OTP
```bash
curl -X POST http://localhost:8080/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+911234567890"}'
```

### Step 2: Verify OTP
```bash
curl -X POST http://localhost:8080/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+911234567890",
    "otp": "123456"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Step 3: Use Access Token
```bash
curl -X GET http://localhost:8080/user/profile \
  -H "Authorization: Bearer eyJ..."
```

### Step 4: Refresh Access Token (when expired)
```bash
curl -X POST http://localhost:8080/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJ..."}'
```

### Step 5: Logout
```bash
curl -X POST http://localhost:8080/auth/logout \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "eyJ..."}'
```

---

## 📝 Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error message describing what went wrong"
  }
}
```

---

## 🚨 Error Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid input parameters |
| 401 | Unauthorized - Invalid or missing authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error - Server-side error |

---

## 🔒 Role-Based Access Control

### Roles

- **admin**: Full access to admin endpoints
- **customer**: Access to customer endpoints only

### Protected Routes

| Route | Required Role |
|-------|---------------|
| `GET /user/profile` | `admin` or `customer` |
| `GET /admin/dashboard` | `admin` only |

### Role Assignment

- Admin role is assigned if phone number matches `ADMIN_PHONE_NUMBER` in environment variables
- All other phone numbers get `customer` role

---

## 📦 Data Models

### User Object
```typescript
{
  id: string;                    // Unique user ID
  phoneNumber: string;           // Phone number with country code
  role: "admin" | "customer";   // User role
  createdAt: Date;               // Account creation timestamp
  updatedAt: Date;               // Last update timestamp
}
```

### JWT Token Payload
```typescript
{
  uid: string;                   // User ID
  phoneNumber: string;           // Phone number
  role: "admin" | "customer";    // User role
  iat: number;                   // Issued at timestamp
  exp: number;                   // Expiration timestamp
}
```

---

## 🧪 Testing Examples

### Using JavaScript (Fetch API)

```javascript
// Send OTP
const sendOTP = async (phoneNumber) => {
  const response = await fetch('http://localhost:8080/auth/send-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phoneNumber }),
  });
  return await response.json();
};

// Verify OTP
const verifyOTP = async (phoneNumber, otp) => {
  const response = await fetch('http://localhost:8080/auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phoneNumber, otp }),
  });
  return await response.json();
};

// Get Profile
const getProfile = async (accessToken) => {
  const response = await fetch('http://localhost:8080/user/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  return await response.json();
};

// Refresh Token
const refreshToken = async (refreshToken) => {
  const response = await fetch('http://localhost:8080/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  return await response.json();
};

// Logout
const logout = async (refreshToken) => {
  const response = await fetch('http://localhost:8080/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });
  return await response.json();
};
```

### Using Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8080',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Send OTP
export const sendOTP = (phoneNumber) => 
  api.post('/auth/send-otp', { phoneNumber });

// Verify OTP
export const verifyOTP = (phoneNumber, otp) => 
  api.post('/auth/verify-otp', { phoneNumber, otp });

// Get Profile
export const getProfile = () => 
  api.get('/user/profile');

// Refresh Token
export const refreshToken = (refreshToken) => 
  api.post('/auth/refresh', { refreshToken });

// Logout
export const logout = (refreshToken) => 
  api.post('/auth/logout', { refreshToken });
```

---

## 📱 OTP Details

### OTP Characteristics

- **Length**: 6 digits
- **Expiry**: 5 minutes
- **Storage**: In-memory (NodeCache)
- **Delivery**: Via Renflair SMS API
- **Usage**: One-time use only

### OTP Format

The OTP is a 6-digit numeric string (e.g., `123456`).

---

## 🛡️ Security Considerations

1. **HTTPS**: Always use HTTPS in production
2. **Token Storage**: Store tokens securely (not in localStorage for web, use secure storage for mobile)
3. **Token Refresh**: Implement automatic token refresh before expiration
4. **OTP Expiry**: OTPs expire after 5 minutes for security
5. **Rate Limiting**: Consider implementing rate limiting for OTP endpoints (not implemented yet)
6. **Phone Validation**: Phone numbers are validated against international format

---

## 📚 Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [JWT.io](https://jwt.io/) - JWT token decoder
- [Renflair SMS API](https://renflair.in/) - SMS provider documentation

---

## 🆘 Support

For issues or questions:
1. Check the error message in the response
2. Verify your request format matches the documentation
3. Ensure your access token is valid and not expired
4. Check that you have the correct role for admin endpoints

---

**Last Updated:** January 2024  
**API Version:** 1.0.0

