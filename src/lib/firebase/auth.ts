import { getFirebaseAuthServices } from './client';
import type { FirebaseUser } from '../menu/types';

export async function getUserClaims(user: FirebaseUser) {
  const services = await getFirebaseAuthServices();
  const tokenResult = await services.authModule.getIdTokenResult(services.auth.currentUser ?? user);
  return tokenResult.claims ?? {};
}

export async function isAdminUser(user: FirebaseUser) {
  const claims = await getUserClaims(user);
  return claims.admin === true;
}
