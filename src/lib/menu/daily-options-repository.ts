import {
  normalizeDailyOptionColor,
  normalizeDailyOptionDescription,
  normalizeDailyOptionIcon,
  normalizeDailyOptionName,
} from './daily-options';
import type { DailyOption, DailyOptionScope } from './types';

type FirebaseServices = { db: any; firestoreModule: any };

const optionsCollection = 'dailyOptions';

function toDate(value: any): Date | undefined {
  return value?.toDate?.() ?? value;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim()).map((item) => item.trim()) : [];
}

function mapDailyOption(id: string, data: Record<string, any>): DailyOption {
  return {
    id,
    name: normalizeDailyOptionName(data.name),
    description: normalizeDailyOptionDescription(data.description),
    active: data.active !== false,
    color: normalizeDailyOptionColor(data.color),
    icon: normalizeDailyOptionIcon(data.icon),
    order: Number.isFinite(data.order) ? Number(data.order) : 0,
    scope: data.scope === 'user' ? 'user' : 'group',
    ownerId: data.ownerId,
    groupId: data.groupId ?? undefined,
    createdBy: data.createdBy,
    members: toStringArray(data.members),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

function optionQuery(services: FirebaseServices, userId: string, groupId?: string) {
  const { db, firestoreModule } = services;
  return groupId
    ? firestoreModule.query(firestoreModule.collection(db, optionsCollection), firestoreModule.where('scope', '==', 'group'), firestoreModule.where('groupId', '==', groupId), firestoreModule.limit(80))
    : firestoreModule.query(firestoreModule.collection(db, optionsCollection), firestoreModule.where('scope', '==', 'user'), firestoreModule.where('ownerId', '==', userId), firestoreModule.limit(80));
}

function optionPayload(
  services: FirebaseServices,
  input: {
    userId: string;
    groupId?: string;
    members?: string[];
    values: { name: string; description?: string; active?: boolean; color?: string; icon?: string; order?: number };
    existing?: Partial<DailyOption>;
  }
) {
  const { firestoreModule } = services;
  const scope: DailyOptionScope = input.groupId ? 'group' : 'user';
  const name = normalizeDailyOptionName(input.values.name);
  if (name.length < 2) throw new Error('daily-option-invalid');

  return {
    name,
    description: normalizeDailyOptionDescription(input.values.description),
    active: input.values.active ?? input.existing?.active ?? true,
    color: normalizeDailyOptionColor(input.values.color ?? input.existing?.color),
    icon: normalizeDailyOptionIcon(input.values.icon ?? input.existing?.icon),
    order: Number.isFinite(input.values.order) ? Number(input.values.order) : input.existing?.order ?? 0,
    scope,
    ownerId: input.groupId ?? input.userId,
    groupId: input.groupId ?? null,
    createdBy: input.existing?.createdBy ?? input.userId,
    members: input.members?.length ? input.members : [input.userId],
    createdAt: input.existing?.createdAt ?? firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
  };
}

export function watchDailyOptions(
  services: FirebaseServices,
  options: { userId: string; groupId?: string },
  callback: (options: DailyOption[]) => void,
  onError: (error: Error) => void
) {
  const { firestoreModule } = services;
  return firestoreModule.onSnapshot(
    optionQuery(services, options.userId, options.groupId),
    (snapshot: any) => {
      const dailyOptions = snapshot.docs.map((item: any) => mapDailyOption(item.id, item.data()));
      callback(dailyOptions.sort((first, second) => first.order - second.order || first.name.localeCompare(second.name)));
    },
    onError
  );
}

export async function saveDailyOption(
  services: FirebaseServices,
  userId: string,
  values: { id?: string; name: string; description?: string; active?: boolean; color?: string; icon?: string; order?: number },
  groupId?: string,
  members: string[] = []
) {
  const { db, firestoreModule } = services;
  if (!values.id) {
    const ref = await firestoreModule.addDoc(
      firestoreModule.collection(db, optionsCollection),
      optionPayload(services, { userId, groupId, members, values })
    );
    return ref.id;
  }

  const ref = firestoreModule.doc(db, optionsCollection, values.id);
  const snapshot = await firestoreModule.getDoc(ref);
  const existing = snapshot.exists() ? mapDailyOption(snapshot.id, snapshot.data()) : undefined;

  await firestoreModule.setDoc(
    ref,
    optionPayload(services, { userId, groupId, members, values, existing }),
    { merge: true }
  );
  return ref.id;
}

export async function deleteDailyOption(services: FirebaseServices, optionId: string) {
  const { db, firestoreModule } = services;
  await firestoreModule.deleteDoc(firestoreModule.doc(db, optionsCollection, optionId));
}
