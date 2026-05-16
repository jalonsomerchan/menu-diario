import { groupShoppingItems, normalizeShoppingItem } from './normalize.ts';
import type { ShoppingItem, ShoppingListDocument, ShoppingScope } from './types.ts';

type FirebaseServices = {
  db: any;
  firestoreModule: any;
};

const shoppingListsCollection = 'shoppingLists';

type SaveShoppingListInput = {
  userId: string;
  groupId?: string;
  scope: ShoppingScope;
  rangeStart: string;
  rangeEnd: string;
  items: ShoppingItem[];
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
  const documentId = getShoppingListDocumentId({
    scope: input.scope,
    ownerId: input.userId,
    groupId: input.groupId,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
  });
  const documentRef = firestoreModule.doc(db, shoppingListsCollection, documentId);
  const snapshot = await firestoreModule.getDoc(documentRef);
  const existing = snapshot.exists() ? mapShoppingList(snapshot.id, snapshot.data()) : null;
  const nextItems = mergePersistedItems(existing?.items ?? [], input.items);
  const source = nextItems.some((item) => item.source === 'manual')
    ? nextItems.some((item) => item.source === 'ai')
      ? 'mixed'
      : 'manual'
    : 'ai';

  await firestoreModule.setDoc(
    documentRef,
    {
      ownerId: input.userId,
      groupId: input.groupId ?? null,
      scope: input.scope,
      source,
      rangeStart: input.rangeStart,
      rangeEnd: input.rangeEnd,
      items: nextItems.map((item) => ({
        id: item.id,
        name: item.name,
        normalizedName: item.normalizedName,
        category: item.category,
        quantity: item.quantity,
        status: item.status,
        forMeals: item.forMeals,
        source: item.source,
        confidence: item.confidence,
        createdAt: item.createdAt ?? firestoreModule.serverTimestamp(),
        updatedAt: firestoreModule.serverTimestamp(),
      })),
      createdAt: snapshot.exists() ? snapshot.data().createdAt ?? firestoreModule.serverTimestamp() : firestoreModule.serverTimestamp(),
      updatedAt: firestoreModule.serverTimestamp(),
      updatedBy: input.userId,
    },
    { merge: true }
  );

  return documentId;
}

function mapShoppingList(id: string, data: Record<string, any>): ShoppingListDocument {
  return {
    id,
    ownerId: data.ownerId ?? '',
    groupId: data.groupId ?? undefined,
    scope: data.scope === 'group' ? 'group' : 'user',
    source: data.source === 'manual' || data.source === 'mixed' ? data.source : 'ai',
    rangeStart: data.rangeStart ?? '',
    rangeEnd: data.rangeEnd ?? '',
    items: Array.isArray(data.items)
      ? groupShoppingItems(
          data.items.map((item: Record<string, any>) =>
            normalizeShoppingItem({
              ...item,
              createdAt: item.createdAt?.toDate?.(),
              updatedAt: item.updatedAt?.toDate?.(),
            })
          )
        )
      : [],
    createdAt: data.createdAt?.toDate?.(),
    updatedAt: data.updatedAt?.toDate?.(),
    updatedBy: data.updatedBy ?? '',
  };
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
