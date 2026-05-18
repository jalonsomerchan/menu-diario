import type { MenuGroup, UserProfile } from './types';

const groupsCollection = 'groups';
const groupProfileReadLimit = 12;

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

function normalizeFoodIntolerances(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueValues(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function mapGroup(id: string, data: Record<string, any>): MenuGroup {
  return {
    id,
    name: data.name ?? 'Menu Diario',
    ownerId: data.ownerId,
    members: data.members ?? [],
    memberEmails: data.memberEmails ?? [],
    pendingEmails: data.pendingEmails ?? [],
    inviteCode: data.inviteCode,
    enabledMeals: Array.isArray(data.enabledMeals) ? data.enabledMeals : ['lunch'],
    updatedAt: data.updatedAt?.toDate?.(),
  };
}

export function getCombinedFoodIntolerances(profiles: Pick<UserProfile, 'foodIntolerances'>[]) {
  return uniqueValues(profiles.map((profile) => normalizeFoodIntolerances(profile.foodIntolerances))).join('\n');
}

export async function getGroupFoodIntolerancesForPrompt(services: FirebaseServices, profile: UserProfile | null) {
  if (!profile) return '';
  if (!profile.groupId) return profile.foodIntolerances;

  const { db, firestoreModule } = services;
  const groupSnapshot = await firestoreModule.getDoc(firestoreModule.doc(db, groupsCollection, profile.groupId));
  const group = groupSnapshot.exists() ? mapGroup(groupSnapshot.id, groupSnapshot.data()) : null;
  if (!group?.members.length) return profile.foodIntolerances;

  const userIds = uniqueValues(group.members).slice(0, groupProfileReadLimit);
  const snapshots = await Promise.all(userIds.map((userId) => firestoreModule.getDoc(firestoreModule.doc(db, 'users', userId))));
  const profiles = snapshots.map((snapshot: any) => ({
    foodIntolerances: normalizeFoodIntolerances(snapshot.exists() ? snapshot.data().foodIntolerances : ''),
  }));

  return getCombinedFoodIntolerances(profiles.length ? profiles : [profile]);
}
