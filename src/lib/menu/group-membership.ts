const groupsCollection = 'groups';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

function normalizeEmail(email = '') {
  return email.trim().toLocaleLowerCase('es-ES');
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function getUserGroupId(data: Record<string, any> | undefined) {
  return typeof data?.groupId === 'string' && data.groupId.trim() ? data.groupId : null;
}

export async function leaveGroupMembership(
  services: FirebaseServices,
  options: {
    groupId: string;
    nextGroupId?: string;
    userId: string;
    email?: string;
  }
) {
  const { groupId, nextGroupId = '', userId, email = '' } = options;
  if (!groupId || groupId === nextGroupId) return;

  const { db, firestoreModule } = services;
  const groupRef = firestoreModule.doc(db, groupsCollection, groupId);
  const snapshot = await firestoreModule.getDoc(groupRef);
  if (!snapshot.exists()) return;

  const data = snapshot.data();
  const members = uniqueValues((data.members ?? []).filter((member: unknown): member is string => typeof member === 'string'));
  if (!members.includes(userId)) return;

  const cleanEmail = normalizeEmail(email);
  const nextMembers = members.filter((member) => member !== userId);
  const nextMemberEmails = cleanEmail
    ? (data.memberEmails ?? []).filter((item: string) => normalizeEmail(item) !== cleanEmail)
    : data.memberEmails ?? [];

  if (nextMembers.length === 0) {
    await firestoreModule.deleteDoc(groupRef);
    return;
  }

  const nextOwnerId = data.ownerId === userId ? nextMembers[0] : data.ownerId;
  await firestoreModule.updateDoc(groupRef, {
    ownerId: nextOwnerId,
    members: nextMembers,
    memberEmails: nextMemberEmails,
    updatedAt: firestoreModule.serverTimestamp(),
  });
}
