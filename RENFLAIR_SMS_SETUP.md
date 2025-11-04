# Renflair SMS Gateway Setup

This document explains how to configure Renflair SMS API for sending OTP messages in production.

## 📋 Overview

The application uses [Renflair SMS Gateway](https://renflair.in/sms.php) for sending OTP verification codes via SMS. This is a production-ready SMS service that works for Indian phone numbers (+91) without requiring DLT registration.

## 🔑 Environment Variables

Add the following to your `.env` file in the `backend` directory:

```env
# Renflair SMS API Configuration
RENFLAIR_API_KEY=your_api_key_here
RENFLAIR_API_URL=https://sms.renflair.in/V1.php
```

### Getting Your API Key

1. Visit [Renflair SMS Gateway](https://renflair.in/sms.php)
2. Login to your account
3. Copy your API Key from the dashboard
4. Add it to your `.env` file as `RENFLAIR_API_KEY`

## 📱 API Implementation

The OTP service uses the Renflair V1 API endpoint for sending OTP:

**Endpoint:** `https://sms.renflair.in/V1.php`

**Method:** GET

**Parameters:**
- `API`: Your Renflair API key
- `PHONE`: 10-digit phone number (without +91)
- `OTP`: 6-digit OTP code

**Example URL:**
```
https://sms.renflair.in/V1.php?API=your_api_key&PHONE=9876543210&OTP=123456
```

**Message Format:**
The SMS message is automatically formatted by Renflair as:
```
{OTP} is your verification code for {your-domain.com}
```

## 🔧 How It Works

1. **User enters phone number** (e.g., `+91 98765 43210`)
2. **System extracts 10-digit number** (e.g., `9876543210`)
3. **System generates 6-digit OTP** (e.g., `123456`)
4. **OTP is stored in cache** for 5 minutes
5. **SMS is sent via Renflair API** with the OTP
6. **User receives SMS** with the verification code
7. **User enters OTP** to complete login

## ✅ Testing

To test the SMS integration:

1. Ensure `RENFLAIR_API_KEY` is set in your `.env` file
2. Start the backend server
3. Try logging in with a real Indian phone number
4. Check your phone for the OTP message
5. Verify the OTP code works

## 🐛 Troubleshooting

### OTP Not Received

1. **Check API Key**: Verify `RENFLAIR_API_KEY` is correct in `.env`
2. **Check Phone Number**: Ensure the phone number is a valid Indian number
3. **Check Credits**: Verify you have SMS credits in your Renflair account
4. **Check Logs**: Look at backend console logs for API response details

### Common Errors

- **"Renflair API key not configured"**: Set `RENFLAIR_API_KEY` in `.env`
- **"Invalid phone number format"**: Phone number must be 10 digits or include country code
- **"Request timeout"**: Check your internet connection or Renflair API status

## 📊 SMS Pricing

According to Renflair pricing:
- ₹250 - ₹2.9K: ₹0.50 per SMS (8 Year validity)
- ₹3K - ₹7.9K: ₹0.40 per SMS (5 Year validity)
- ₹8K - ₹14.9K: ₹0.30 per SMS (4 Year validity)
- ₹15K - ₹69.9K: ₹0.22 per SMS (3 Year validity)
- ₹70K+: ₹0.18 per SMS (1 Year validity)

Minimum recharge: ₹250

## 🔒 Security Notes

- API key is stored in `.env` file (never commit to git)
- OTP is stored in memory cache for 5 minutes only
- OTP is deleted after successful verification
- Phone numbers are validated before sending SMS

## 📚 Documentation

For more details, visit: [Renflair SMS Gateway Documentation](https://renflair.in/sms.php)

