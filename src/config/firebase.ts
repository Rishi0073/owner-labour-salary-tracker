// =====================================================================
// FIREBASE & FIRESTORE CONFIGURATION
// Connects to Firebase Cloud Firestore with automatic real-time sync
// =====================================================================

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyMockKeyForDevelopmentOnly123456',
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'shramik-salary-tracker.firebaseapp.com',
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'shramik-salary-tracker',
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'shramik-salary-tracker.appspot.com',
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456',
};

export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firestore: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

export const isFirebaseConfigured = Boolean(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY &&
    !process.env.EXPO_PUBLIC_FIREBASE_API_KEY.includes('Mock')
);
