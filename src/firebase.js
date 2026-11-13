import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: 'G-VWZ66S8HMY',
};

export const isFirebaseConfigured = Object.values(config).every(Boolean);
export const firebaseApp = isFirebaseConfigured
  ? (getApps()[0] || initializeApp(config))
  : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();
export const db = firebaseApp
  ? getFirestore(firebaseApp)
  : null;

export async function initializeAnalytics() {
  if (!firebaseApp || !config.measurementId || !import.meta.env.PROD) {
    return null;
  }

  try {
    if (!(await isSupported())) return null;
    return getAnalytics(firebaseApp);
  } catch (error) {
    console.warn('Firebase Analytics is unavailable in this browser:', error);
    return null;
  }
}
