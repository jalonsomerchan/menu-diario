import { getFirebaseConfig, hasFirebaseConfig } from './config';

type FirebaseModuleName = 'app' | 'auth' | 'firestore';

type FirebaseServices = {
  app: any;
  auth: any;
  db: any;
  authModule: any;
  firestoreModule: any;
};

const firebaseVersion = '12.6.0';
let servicesPromise: Promise<FirebaseServices> | undefined;

async function importFirebaseModule(name: FirebaseModuleName) {
  return import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-${name}.js`);
}

export async function getFirebaseServices() {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase public config is missing. Check .env.example.');
  }

  servicesPromise ??= Promise.all([
    importFirebaseModule('app'),
    importFirebaseModule('auth'),
    importFirebaseModule('firestore'),
  ]).then(([appModule, authModule, firestoreModule]) => {
    const app = appModule.initializeApp(getFirebaseConfig());

    return {
      app,
      auth: authModule.getAuth(app),
      db: firestoreModule.getFirestore(app),
      authModule,
      firestoreModule,
    };
  });

  return servicesPromise;
}

export async function getFirebaseApp() {
  const { app } = await getFirebaseServices();

  return app;
}

export async function signInWithGoogle() {
  const { auth, authModule } = await getFirebaseServices();
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  return authModule.signInWithPopup(auth, provider);
}

export async function signInAsGuest() {
  const { auth, authModule } = await getFirebaseServices();

  return authModule.signInAnonymously(auth);
}

export async function closeSession() {
  const { auth, authModule } = await getFirebaseServices();

  return authModule.signOut(auth);
}
