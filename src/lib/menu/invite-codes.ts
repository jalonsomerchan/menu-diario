const inviteCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const defaultInviteCodeLength = 8;
const defaultUniqueCodeAttempts = 8;

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

function getSecureRandomIndex(maxExclusive: number) {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] % maxExclusive;
}

export function createInviteCode(length = defaultInviteCodeLength) {
  return Array.from({ length }, () => inviteCodeAlphabet[getSecureRandomIndex(inviteCodeAlphabet.length)]).join('');
}

async function inviteCodeExists(services: FirebaseServices, collectionName: string, inviteCode: string) {
  const { db, firestoreModule } = services;
  const snapshot = await firestoreModule.getDocs(
    firestoreModule.query(
      firestoreModule.collection(db, collectionName),
      firestoreModule.where('inviteCode', '==', inviteCode),
      firestoreModule.limit(1)
    )
  );

  return snapshot.docs.length > 0;
}

export async function createUniqueInviteCode(
  services: FirebaseServices,
  collectionName: string,
  attempts = defaultUniqueCodeAttempts
) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const inviteCode = createInviteCode();
    if (!(await inviteCodeExists(services, collectionName, inviteCode))) {
      return inviteCode;
    }
  }

  throw new Error('invite-code-collision');
}
