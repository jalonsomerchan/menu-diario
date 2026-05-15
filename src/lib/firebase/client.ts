import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getFirebaseConfig, hasFirebaseConfig } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

export function getFirebaseServices() {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase public config is missing. Check .env.example.');
  }

  app ??= initializeApp(getFirebaseConfig());
  auth ??= getAuth(app);
  db ??= getFirestore(app);

  return { app, auth, db };
}

export async function signInWithGoogle() {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  return signInWithPopup(auth, provider);
}

export async function signInAsGuest() {
  const { auth } = getFirebaseServices();

  return signInAnonymously(auth);
}

export async function closeSession() {
  const { auth } = getFirebaseServices();

  return signOut(auth);
}
