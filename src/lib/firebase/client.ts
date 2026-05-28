import { initializeFirebaseAppCheck } from './app-check';
import { getFirebaseConfig, hasFirebaseConfig } from './config';

type FirebaseModuleName = 'app' | 'auth' | 'firestore';

type FirebaseAuthServices = {
  app: any;
  auth: any;
  authModule: any;
};

type FirebaseServices = {
  app: any;
  auth: any;
  db: any;
  authModule: any;
  firestoreModule: any;
};

const firebaseVersion = '12.6.0';
let appPromise: Promise<any> | undefined;
let authServicesPromise: Promise<FirebaseAuthServices> | undefined;
let servicesPromise: Promise<FirebaseServices> | undefined;
let appCheckPromise: Promise<unknown> | undefined;

async function importFirebaseModule(name: FirebaseModuleName) {
  return import(/* @vite-ignore */ `https://www.gstatic.com/firebasejs/${firebaseVersion}/firebase-${name}.js`);
}

export { hasFirebaseConfig };

async function getFirebaseAppInstance() {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase public config is missing. Check .env.example.');
  }

  appPromise ??= importFirebaseModule('app').then((appModule) => appModule.initializeApp(getFirebaseConfig()));

  return appPromise;
}

async function ensureFirebaseAppCheck() {
  const app = await getFirebaseAppInstance();
  appCheckPromise ??= initializeFirebaseAppCheck(app);
  return appCheckPromise;
}

export async function getFirebaseAuthServices() {
  if (!hasFirebaseConfig()) {
    throw new Error('Firebase public config is missing. Check .env.example.');
  }

  authServicesPromise ??= Promise.all([getFirebaseAppInstance(), importFirebaseModule('auth')]).then(
    ([app, authModule]) => {
      void ensureFirebaseAppCheck();

      return {
        app,
        auth: authModule.getAuth(app),
        authModule,
      };
    }
  );

  return authServicesPromise;
}

export async function getFirebaseServices() {
  servicesPromise ??= Promise.all([getFirebaseAuthServices(), importFirebaseModule('firestore')]).then(
    async ([authServices, firestoreModule]) => {
      await ensureFirebaseAppCheck();

      return {
        ...authServices,
        db: firestoreModule.getFirestore(authServices.app),
        firestoreModule,
      };
    }
  );

  return servicesPromise;
}

export async function getFirebaseApp() {
  const app = await getFirebaseAppInstance();

  return app;
}

export async function signInWithGoogle() {
  const { auth, authModule } = await getFirebaseAuthServices();
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  return authModule.signInWithPopup(auth, provider);
}

export async function signInAsGuest() {
  const { auth, authModule } = await getFirebaseAuthServices();

  return authModule.signInAnonymously(auth);
}

export async function closeSession() {
  const { auth, authModule } = await getFirebaseAuthServices();

  return authModule.signOut(auth);
}
