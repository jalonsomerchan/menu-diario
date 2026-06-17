import { groupShoppingItems, normalizeShoppingItem } from './normalize.ts';
import type { ShoppingItem, ShoppingListDocument, ShoppingListStatus, ShoppingScope } from './types.ts';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

const shoppingListsCollection = 'shoppingLists';

type SaveShoppingListInput = {
  userId: string;
  groupId?: string;
  scope: ShoppingScope;
  title?: string;
  rangeStart: string;
  rangeEnd: string;
  items: ShoppingItem[];
  listId?: string;
  status?: ShoppingListStatus;
};

type ShoppingListQueryInput = {
  scope: ShoppingScope;
  ownerId: string;
  groupId?: string;
};

export function getShoppingListDocumentId(input: {
  scope: ShoppingScope;
  ownerId: string;
  groupId?: string;
  rangeStart: string;
  rangeEnd: string;
}) {
  const ownerKey = input.scope === 'group' ? input.groupId ?? input.ownerId : input.ownerId;
  return [input.scope, ownerKey, input.rangeStart, input.rangeEnd].filter(Boolean).join('__');
}

export function getShoppingListCollectionOwnerId(input: ShoppingListQueryInput) {
  return input.scope === 'group' ? input.groupId ?? input.ownerId : input.ownerId;
}

export function watchShoppingLists(
  services: FirebaseServices,
  input: ShoppingListQueryInput,
  callback: (value: ShoppingListDocument[]) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const ownerId = getShoppingListCollectionOwnerId(input);
  const filters = [
    firestoreModule.where('scope', '==', input.scope),
    firestoreModule.where(input.scope === 'group' ? 'groupId' : 'ownerId', '==', ownerId),
    firestoreModule.limit(100),
  ];
  const query = firestoreModule.query(firestoreModule.collection(db, shoppingListsCollection), ...filters);

  return firestoreModule.onSnapshot(
    query,
    (snapshot: any) => {
      const lists = snapshot.docs
        .map((item: any) => mapShoppingList(item.id, item.data()))
        .sort((left: ShoppingListDocument, right: ShoppingListDocument) => {
          const leftDate = left.updatedAt?.getTime() ?? left.createdAt?.getTime() ?? 0;
          const rightDate = right.updatedAt?.getTime() ?? right.createdAt?.getTime() ?? 0;
          return rightDate - leftDate;
        });
      callback(lists);
    },
    onError
  );
}

export function watchShoppingList(
  services: FirebaseServices,
  input: { scope: ShoppingScope; ownerId: string; groupId?: string; rangeStart: string; rangeEnd: string },
  callback: (value: ShoppingListDocument | null) => void,
  onError: (error: Error) => void
) {
  const { db, firestoreModule } = services;
  const documentId = getShoppingListDocumentId(input);
  return firestoreModule.onSnapshot(
    firestoreModule.doc(db, shoppingListsCollection, documentId),
    (snapshot: any) => callback(snapshot.exists() ? mapShoppingList(snapshot.id, snapshot.data()) : null),
    onError
  );
}

export async function saveShoppingList(services: FirebaseServices, input: SaveShoppingListInput) {
  const { db, firestoreModule } = services;
  const documentId = input.listId || firestoreModule.doc(firestoreModule.collection(db, shoppingListsCollection)).id;
  const documentRef = firestoreModule.doc(db, shoppingListsCollection, documentId);
  const snapshot = input.listId ? await firestoreModule.getDoc(documentRef) : null;
  const existingData = snapshot?.exists() ? snapshot.data() : null;
  const existing = existingData && snapshot ? mapShoppingList(snapshot.id, existingData) : null;
  const nextItems = mergePersistedItems(existing?.items ?? [], input.items);
  const source = nextItems.some((item) => item.source === 'manual')
    ? nextItems.some((item) => item.source === 'ai')
      ? 'mixed'
      : 'manual'
    : 'ai';

  await firestoreModule.setDoc(
    documentRef,
    {
      title: input.title?.trim() || existing?.title || input.rangeStart || 'Shopping list',
      ownerId: existing?.ownerId ?? input.userId,
      groupId: input.groupId ?? null,
      scope: input.scope,
      status: input.status ?? existing?.status ?? 'active',
      source,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      items: serializeShoppingItems(nextItems),
      createdAt: existingData?.createdAt ?? firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
      updatedBy: input.userId,
      archivedAt: input.status === 'archived' ? firestoreModule.serverTimestamp() : null,
    },
    { merge: true }
  );

  return documentId;
}

export async function updateShoppingListTitle(
  services: FirebaseServices,
  input: { listId: string; userId: string; title: string }
) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, shoppingListsCollection, input.listId), {
    title: input.title.trim(),
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: input.userId,
  });
}

export async function archiveShoppingList(services: FirebaseServices, input: { listId: string; userId: string }) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, shoppingListsCollection, input.listId), {
    status: 'archived',
    archivedAt: firestoreModule.serverTimestamp(),
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: input.userId,
  });
}

export async function updateShoppingListStatus(
  services: FirebaseServices,
  input: { listId: string; userId: string; status: ShoppingListStatus }
) {
  const { db, firestoreModule } = services;
  await firestoreModule.updateDoc(firestoreModule.doc(db, shoppingListsCollection, input.listId), {
    status: input.status,
    archivedAt: input.status === 'archived' ? firestoreModule.serverTimestamp() : null,
    updatedAt: firestoreModule.serverTimestamp(),
    updatedBy: input.userId,
  });
}

export async function deleteShoppingList(services: FirebaseServices, listId: string) {
  const { db, firestoreModule } = services;
  await firestoreModule.deleteDoc(firestoreModule.doc(db, shoppingListsCollection, listId));
}

export async function duplicateShoppingList(
  services: FirebaseServices,
  input: { list: ShoppingListDocument; userId: string; title: string }
) {
  return saveShoppingList(services, {
    userId: input.userId,
    groupId: input.list.groupId,
    scope: input.list.scope,
    title: input.title,
    rangeStart: input.list.rangeStart,
    rangeEnd: input.list.rangeEnd,
    items: input.list.items.map((item, index) => ({ ...item, id: `${item.id}-copy-${index}`, checked: false, status: 'to-buy' as const })),
    status: 'active',
  });
}

function mapShoppingList(id: string, data: Record<string, any>): ShoppingListDocument {
  return {
    id,
    title: data.title ?? data.name ?? '',
    ownerId: data.ownerId ?? '',
    groupId: data.groupId ?? undefined,
    scope: data.scope === 'group' ? 'group' : 'user',
    status: data.status === 'archived' || data.status === 'completed' ? data.status : 'active',
    source: data.source === 'manual' || data.source === 'mixed' ? data.source : 'ai',
    rangeStart: data.rangeStart ?? '',
    rangeEnd: data.rangeEnd ?? '',
    items: Array.isArray(data.items)
      ? groupShoppingItems(
          data.items.map((item: Record<string, any>, index: number) =>
            normalizeShoppingItem(
              {
                ...item,
                createdAt: item.createdAt?.toDate?.(),
                updatedAt: item.updatedAt?.toDate?.(),
              },
              index
            )
          )
        )
      : [],
    createdAt: data.createdAt?.toDate?.(),
    updatedAt: data.updatedAt?.toDate?.(),
    updatedBy: data.updatedBy ?? '',
    archivedAt: data.archivedAt?.toDate?.(),
  };
}

function serializeShoppingItems(items: ShoppingItem[]) {
  return groupShoppingItems(items).map((item, index) => ({
    id: item.id,
    name: item.name,
    normalizedName: item.normalizedName,
    category: item.category,
    quantity: item.quantity,
    note: item.note,
    checked: Boolean(item.checked),
    order: Number.isFinite(item.order) ? item.order : index,
    status: item.checked ? 'owned' : item.status,
    forMeals: item.forMeals,
    source: item.source,
    confidence: item.confidence,
  }));
}

function mergePersistedItems(existingItems: ShoppingItem[], incomingItems: ShoppingItem[]) {
  const manualById = new Map(existingItems.filter((item) => item.source === 'manual').map((item) => [item.id, item] as const));
  incomingItems.forEach((item) => {
    if (item.source === 'manual') {
      manualById.set(item.id, item);
    }
  });

  const nextAiItems = incomingItems.filter((item) => item.source !== 'manual');
  return groupShoppingItems([...manualById.values(), ...nextAiItems]);
}
