# Admin Management System

## Overview

The admin system has two levels:

1. **Super Admin**: The main admin defined by `ADMIN_PHONE_NUMBER` in `.env` file
2. **Co-Admins**: Users appointed by the super admin who have admin dashboard access but cannot appoint other admins

## Super Admin

### Who is the Super Admin?

The super admin is determined by the phone number set in the `.env` file:

```env
ADMIN_PHONE_NUMBER=+91XXXXXXXXXX
```

**The user with this phone number is the super admin.**

### Super Admin Capabilities

- ✅ Access to admin dashboard
- ✅ Can appoint co-admins
- ✅ Can remove co-admins
- ✅ Can view all co-admins
- ✅ All regular admin features (manage bookings, pricing, etc.)

## Co-Admins

### What are Co-Admins?

Co-admins are users appointed by the super admin. They have:
- ✅ Access to admin dashboard
- ✅ All regular admin features (manage bookings, pricing, etc.)
- ❌ **Cannot** appoint other admins
- ❌ **Cannot** remove other admins
- ❌ **Cannot** view co-admin management endpoints

## API Endpoints

### Appoint Co-Admin (Super Admin Only)

**POST** `/admin/co-admins`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Body:**
```json
{
  "phoneNumber": "+91XXXXXXXXXX",
  "name": "Admin Name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coAdmin": {
      "id": "user_id",
      "phoneNumber": "+91XXXXXXXXXX",
      "name": "Admin Name",
      "role": "admin",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "createdBy": "super_admin_user_id"
    }
  },
  "message": "Co-admin appointed successfully"
}
```

### Get All Co-Admins (Super Admin Only)

**GET** `/admin/co-admins`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coAdmins": [
      {
        "id": "user_id",
        "phoneNumber": "+91XXXXXXXXXX",
        "name": "Admin Name",
        "role": "admin",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "createdBy": "super_admin_user_id"
      }
    ]
  }
}
```

### Remove Co-Admin (Super Admin Only)

**DELETE** `/admin/co-admins/:id`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Co-admin removed successfully"
}
```

## How It Works

### 1. Super Admin Login

When a user logs in with the phone number matching `ADMIN_PHONE_NUMBER`:
- They get `role: "admin"` in the database
- The system recognizes them as super admin by checking their phone number
- They can access all admin endpoints including co-admin management

### 2. Appointing a Co-Admin

1. Super admin calls `POST /admin/co-admins` with:
   - `phoneNumber`: The phone number of the user to make admin
   - `name`: The name of the user

2. System checks:
   - ✅ Requesting user is super admin
   - ✅ Phone number is not the super admin's phone number
   - ✅ User exists or will be created

3. If user exists:
   - Their role is updated to `"admin"` in Firestore
   
4. If user doesn't exist:
   - A new user is created with `role: "admin"`

### 3. Co-Admin Access

Co-admins can:
- Access `/admin/dashboard`
- Access all booking management endpoints
- Access pricing management endpoints
- Access analytics endpoints

Co-admins **cannot**:
- Access `/admin/co-admins` endpoints (will get 403 Forbidden)

### 4. Removing a Co-Admin

1. Super admin calls `DELETE /admin/co-admins/:id`
2. System checks:
   - ✅ Requesting user is super admin
   - ✅ Target user is not super admin
   - ✅ Target user is an admin
3. User's role is changed back to `"customer"`

## Security

- Super admin is determined by phone number matching `ADMIN_PHONE_NUMBER` in `.env`
- Co-admin management endpoints use `requireSuperAdmin` middleware
- Regular admin endpoints use `requireRole("admin")` which allows both super admin and co-admins
- Phone number verification happens at middleware level

## Example Flow

1. **Super Admin Setup:**
   ```env
   ADMIN_PHONE_NUMBER=+919876543210
   ```

2. **Super Admin Logs In:**
   - Phone: `+919876543210`
   - Gets `role: "admin"`
   - System recognizes as super admin

3. **Super Admin Appoints Co-Admin:**
   ```bash
   POST /admin/co-admins
   {
     "phoneNumber": "+911234567890",
     "name": "John Doe"
   }
   ```

4. **Co-Admin Logs In:**
   - Phone: `+911234567890`
   - Gets `role: "admin"`
   - Can access admin dashboard
   - Cannot access co-admin management

5. **Super Admin Removes Co-Admin:**
   ```bash
   DELETE /admin/co-admins/{co_admin_user_id}
   ```

6. **User Becomes Customer:**
   - Phone: `+911234567890`
   - Role changed to `"customer"`
   - No longer has admin access

