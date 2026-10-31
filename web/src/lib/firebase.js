import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase web app config, read from web/.env.local (template: web/.env.example).
// It identifies a project and ships inside every build, so it is not a secret, but it differs
// per deployment and is therefore not committed.
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  appId: env.VITE_FIREBASE_APP_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
};

const missing = ['apiKey', 'appId', 'projectId', 'authDomain'].filter((k) => !firebaseConfig[k]);
if (missing.length) {
  throw new Error(`Missing Firebase config: ${missing.join(', ')}. Copy web/.env.example to web/.env.local and fill in your Firebase web app values (see docs/SETUP.md).`);
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
