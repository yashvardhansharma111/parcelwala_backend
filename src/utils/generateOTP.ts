/**
 * OTP Generator Utility
 * Generates a 6-digit random OTP
 */

export const generateOTP = (): string => {
  // Generate a random 6-digit number
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
};

