import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: 'REDACTED_FIREBASE_API_KEY',
  appId: '1:884305199718:web:27c2bd5365d45ad0afa3a7',
  messagingSenderId: '884305199718',
  projectId: 'rice-ai-appp',
  authDomain: 'rice-ai-appp.firebaseapp.com',
  storageBucket: 'rice-ai-appp.firebasestorage.app',
  measurementId: 'G-MZWCL96RJ9',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
