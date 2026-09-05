/**
 * Minimal promise-based IndexedDB wrapper.
 *
 * This is the only file that talks to IndexedDB directly. Everything else
 * (the repository, components) goes through `JournalRepository`
 * (see `repository.ts`), so this file can be deleted wholesale on the day
 * a `SupabaseRepository` replaces it — no other code needs to change.
 */

const DB_NAME = "travel-journal";
const DB_VERSION = 1;

export const STORES = {
  trips: "trips",
  days: "days",
  recordings: "recordings",
  transcripts: "transcripts",
  events: "events",
  blogs: "blogs",
  images: "images",
  blobs: "blobs", // binary payloads for recordings + images, keyed by blobKey
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in this environment"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.trips)) {
        db.createObjectStore(STORES.trips, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.days)) {
        const store = db.createObjectStore(STORES.days, { keyPath: "id" });
        store.createIndex("tripId", "tripId");
      }
      if (!db.objectStoreNames.contains(STORES.recordings)) {
        const store = db.createObjectStore(STORES.recordings, { keyPath: "id" });
        store.createIndex("dayId", "dayId");
      }
      if (!db.objectStoreNames.contains(STORES.transcripts)) {
        const store = db.createObjectStore(STORES.transcripts, { keyPath: "id" });
        store.createIndex("dayId", "dayId");
      }
      if (!db.objectStoreNames.contains(STORES.events)) {
        const store = db.createObjectStore(STORES.events, { keyPath: "id" });
        store.createIndex("dayId", "dayId");
      }
      if (!db.objectStoreNames.contains(STORES.blogs)) {
        const store = db.createObjectStore(STORES.blogs, { keyPath: "id" });
        store.createIndex("dayId", "dayId");
      }
      if (!db.objectStoreNames.contains(STORES.images)) {
        const store = db.createObjectStore(STORES.images, { keyPath: "id" });
        store.createIndex("dayId", "dayId");
      }
      if (!db.objectStoreNames.contains(STORES.blobs)) {
        db.createObjectStore(STORES.blobs, { keyPath: "key" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    if (!req) {
      tx.oncomplete = () => resolve(undefined as T);
      tx.onerror = () => reject(tx.error);
      return;
    }
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut<T>(storeName: string, value: T): Promise<void> {
  await withStore(storeName, "readwrite", (store) => store.put(value));
}

export async function dbGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return withStore<T>(storeName, "readonly", (store) => store.get(key));
}

export async function dbGetAll<T>(storeName: string): Promise<T[]> {
  return withStore<T[]>(storeName, "readonly", (store) => store.getAll());
}

export async function dbGetAllByIndex<T>(
  storeName: string,
  indexName: string,
  value: string
): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(storeName: string, key: string): Promise<void> {
  await withStore(storeName, "readwrite", (store) => store.delete(key));
}

export async function blobPut(key: string, blob: Blob): Promise<void> {
  await dbPut(STORES.blobs, { key, blob });
}

export async function blobGet(key: string): Promise<Blob | undefined> {
  const record = await dbGet<{ key: string; blob: Blob }>(STORES.blobs, key);
  return record?.blob;
}

export async function blobDelete(key: string): Promise<void> {
  await dbDelete(STORES.blobs, key);
}
