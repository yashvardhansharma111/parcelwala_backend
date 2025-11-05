# Production Deployment Checklist

## ✅ Changes Made for Production

### 1. OTP Service - Production Mode Enabled
- ✅ **Removed development mode check** - OTP service now always sends real SMS
- ✅ **Renflair SMS integration active** - All OTPs sent via Renflair API
- ✅ Validates Renflair API key before sending

### 2. Payment Gateway - Production Ready
- ✅ Paygic payment integration configured
- ✅ Webhook handler for payment status updates
- ✅ Payment status verification endpoint
- ✅ Payment opens in external browser (production ready)

## 📋 Required Environment Variables

### Backend `.env` File

```env
# Node Environment
NODE_ENV=production

# Renflair SMS Configuration
RENFLAIR_API_KEY=your_renflair_api_key_here

# Paygic Payment Gateway Configuration
PAYGIC_MID=your_merchant_id_here
PAYGIC_TOKEN=your_paygic_token_here
PAYGIC_BASE_URL=https://server.paygic.in/api/v2
PAYGIC_SUCCESS_URL=https://your-backend-url.com/api/payments/webhook
PAYGIC_FAILED_URL=https://your-backend-url.com/api/payments/webhook

# Firebase Configuration
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key

# JWT Configuration
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# Admin Phone Number
ADMIN_PHONE_NUMBER=+91your_admin_phone
```

## ✅ Verification Steps

### 1. SMS Configuration (Renflair)
- [ ] Set `RENFLAIR_API_KEY` in `.env` file
- [ ] Test OTP sending to verify Renflair API is working
- [ ] Verify OTP is received on mobile device
- [ ] Check backend logs for Renflair API responses

### 2. Payment Configuration (Paygic)
- [ ] Set `PAYGIC_MID` and `PAYGIC_TOKEN` in `.env` file
- [ ] Set `PAYGIC_BASE_URL=https://server.paygic.in/api/v2`
- [ ] Configure webhook URLs:
  - `PAYGIC_SUCCESS_URL` - Your backend webhook endpoint
  - `PAYGIC_FAILED_URL` - Your backend webhook endpoint
- [ ] Ensure webhook endpoint is publicly accessible
- [ ] Test complete payment flow:
  - [ ] Create booking
  - [ ] Initiate payment
  - [ ] Complete payment in browser
  - [ ] Verify webhook updates booking status
  - [ ] Verify payment status in admin panel

### 3. Backend Deployment
- [ ] Set `NODE_ENV=production` in production environment
- [ ] Verify all environment variables are set
- [ ] Test backend API endpoints
- [ ] Verify Firebase credentials are configured
- [ ] Check webhook endpoint is accessible publicly

### 4. Frontend Configuration
- [ ] Update API base URL to production backend
- [ ] Test OTP flow (should receive real SMS)
- [ ] Test payment flow (should open in external browser)
- [ ] Verify payment verification works
- [ ] Test booking creation and status updates

## 🔒 Security Checklist

- [ ] All sensitive credentials in environment variables (not in code)
- [ ] `.env` file is in `.gitignore` (never committed)
- [ ] Production environment variables are secure
- [ ] Webhook endpoint is protected (if needed)
- [ ] Firebase credentials are production credentials

## 📝 Important Notes

1. **OTP Service**: 
   - ✅ **Now always sends real SMS** (development mode removed)
   - Will use Renflair API for all OTP requests
   - Requires valid `RENFLAIR_API_KEY` in environment

2. **Payment Gateway**:
   - ✅ Opens in external browser (production ready)
   - ✅ Webhook handles payment status updates automatically
   - ✅ Payment verification checks actual payment status
   - Webhook URL must be publicly accessible from Paygic servers

3. **Push Notifications**:
   - Configured to send notifications on booking status changes
   - Requires FCM tokens to be registered (frontend implementation needed)

## 🚀 Deployment Steps

1. Set all environment variables in production environment
2. Deploy backend with production environment
3. Verify OTP sending works (test with real phone number)
4. Verify payment flow works end-to-end
5. Monitor logs for any errors
6. Test complete user flow: Signup → Booking → Payment → Delivery

## 📞 Support

If issues occur:
- Check backend logs for Renflair API responses
- Check backend logs for Paygic API responses
- Verify webhook is receiving requests from Paygic
- Test payment flow manually
- Verify environment variables are correctly set

