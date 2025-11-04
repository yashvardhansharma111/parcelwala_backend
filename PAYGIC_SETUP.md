# Paygic Payment Gateway Setup

This document describes how to configure Paygic payment gateway integration.

## Environment Variables

Add the following environment variables to your `.env` file in the `backend` directory:

```env
# Paygic Payment Gateway Credentials
PAYGIC_MID=your_merchant_id_here
PAYGIC_TOKEN=your_auth_token_here
PAYGIC_BASE_URL=https://server.paygic.in/api/v2
PAYGIC_SUCCESS_URL=https://yourdomain.com/api/payments/success
PAYGIC_FAILED_URL=https://yourdomain.com/api/payments/failed
```

## Configuration Details

### Required Variables

- **PAYGIC_MID**: Your Paygic Merchant ID (provided by Paygic)
- **PAYGIC_TOKEN**: Your Paygic Authentication Token (provided by Paygic)

### Optional Variables

- **PAYGIC_BASE_URL**: Paygic API base URL (defaults to `https://server.paygic.in/api/v2`)
- **PAYGIC_SUCCESS_URL**: URL where users will be redirected after successful payment. This should be a publicly accessible URL that points to your backend endpoint.
- **PAYGIC_FAILED_URL**: URL where users will be redirected after failed payment. This should be a publicly accessible URL that points to your backend endpoint.

## Webhook/Callback Setup

Paygic will send payment status updates to your webhook endpoint. Make sure your backend server is publicly accessible and the webhook endpoint is configured in your Paygic dashboard:

**Webhook URL**: `https://yourdomain.com/api/payments/webhook`

The webhook will receive POST requests with payment status updates and automatically update booking payment status in your database.

## Testing

1. Use Paygic test credentials (if available) for development
2. Test payment flow:
   - Create a booking with online payment method
   - Initiate payment to get payment URL
   - Complete payment on Paygic page
   - Verify webhook is called and booking status updated

## Production Checklist

- [ ] Replace test credentials with production credentials
- [ ] Configure production webhook URL in Paygic dashboard
- [ ] Set `PAYGIC_SUCCESS_URL` and `PAYGIC_FAILED_URL` to production URLs
- [ ] Test complete payment flow end-to-end
- [ ] Monitor webhook logs for payment updates

## API Endpoints

### Frontend Calls (via backend API)

- **POST** `/api/payments/create` - Create payment page
- **POST** `/api/payments/status` - Check payment status

### Paygic Callbacks

- **POST** `/api/payments/webhook` - Webhook handler (called by Paygic)
- **GET** `/api/payments/success` - Success redirect handler
- **GET** `/api/payments/failed` - Failed redirect handler

