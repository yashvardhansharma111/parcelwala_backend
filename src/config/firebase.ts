/**
 * Firebase Admin SDK Initialization
 * Initializes Firestore & Auth for server-side operations
 */

import dotenv from "dotenv";
dotenv.config(); // Ensure .env is loaded early

import * as admin from "firebase-admin";
import { getApps } from "firebase-admin/app";
import { AppCreds } from "./creds";

// Safely parse private key (handle \n from .env)
const privateKey = AppCreds.firebase.privateKey?.replace(/\\n/g, "\n");

if (!AppCreds.firebase.projectId || !AppCreds.firebase.clientEmail || !privateKey) {
  console.error("❌ Missing Firebase credentials in AppCreds:");
  console.error("projectId:", AppCreds.firebase.projectId);
  console.error("clientEmail:", AppCreds.firebase.clientEmail);
  console.error("hasPrivateKey:", !!AppCreds.firebase.privateKey);
  throw new Error(
    "Firebase credentials not configured. Please check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env"
  );
}

// Initialize Firebase Admin SDK only once
if (getApps().length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: AppCreds.firebase.projectId,
      clientEmail: AppCreds.firebase.clientEmail,
      privateKey,
    }),
  });

  console.log(`✅ Firebase connected successfully: ${AppCreds.firebase.projectId}`);
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
