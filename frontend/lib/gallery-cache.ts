const DB_NAME = "brainrot-matcher";
const STORE = "cache-v2";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* cache is optional */
  }
}

export async function cachedArrayBuffer(url: string): Promise<ArrayBuffer> {
  const key = `buf:${url}`;
  const hit = await idbGet<ArrayBuffer>(key);
  if (hit && hit.byteLength > 64) {
    return hit;
  }
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Could not download ${url}`);
  }
  const buf = await res.arrayBuffer();
  await idbSet(key, buf);
  return buf;
}
