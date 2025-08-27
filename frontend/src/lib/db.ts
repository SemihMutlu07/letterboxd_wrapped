
const DB_NAME = 'letterboxd-wrapped';
const DB_VERSION = 1;

// Stores
// - sessions: key=sessionId, value={ stats, meta, createdAt, size }
// - tmdbCache: key=keyHash, value={ url, createdAt, ttlHours }
// - settings: key='settings', value={ storeLocal, allowDiagnostics, allowAnalytics }

export type SessionRecord = {
  stats: unknown;
  meta?: Record<string, unknown>;
  createdAt: number;
  size: number;
};

export type TmdbCacheRecord = {
  keyHash: string;
  url: string | null;
  createdAt: number;
  ttlHours: number;
};

const QUOTA_BYTES = 20 * 1024 * 1024; // 20 MB

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'sessionId' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('tmdbCache')) {
        const t = db.createObjectStore('tmdbCache', { keyPath: 'keyHash' });
        t.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStore(db: IDBDatabase, name: string, mode: IDBTransactionMode = 'readonly') {
  const tx = db.transaction(name, mode);
  return tx.objectStore(name);
}

export async function saveSession(sessionId: string, payload: { stats: unknown; meta?: Record<string, unknown> }) {
  const db = await openDb();
  const store = await getStore(db, 'sessions', 'readwrite');
  const value: SessionRecord & { sessionId: string } = {
    sessionId,
    stats: payload.stats,
    meta: payload.meta ?? {},
    createdAt: Date.now(),
    size: new Blob([JSON.stringify(payload)]).size,
  } as SessionRecord & { sessionId: string };
  await request(store.put(value));
  await enforceQuota(db);
}

export async function loadLastSession(): Promise<{ sessionId: string; record: SessionRecord } | null> {
  const db = await openDb();
  const store = await getStore(db, 'sessions');
  const idx = store.index('createdAt');
  const result = await getLast(idx);
  return result as { sessionId: string; record: SessionRecord } | null;
}

export async function exportSessionZip(sessionId: string): Promise<Blob> {
  const db = await openDb();
  const store = await getStore(db, 'sessions');
  const rec = (await request(store.get(sessionId))) as (SessionRecord | undefined);
  const files: Record<string, Blob> = {};
  const statsJson = JSON.stringify((rec?.stats ?? {}) as Record<string, unknown>, null, 2);
  const metaJson = JSON.stringify((rec?.meta ?? {}) as Record<string, unknown>, null, 2);
  files[`session-${sessionId}-stats.json`] = new Blob([statsJson], { type: 'application/json' });
  files[`session-${sessionId}-meta.json`] = new Blob([metaJson], { type: 'application/json' });
  // Minimal zip (store only) — to avoid new deps, return a fake multipart blob
  const boundary = '----lw-diagnostics';
  const parts: (string | Blob)[] = [];
  for (const [name, blob] of Object.entries(files)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${blob.type}\r\n\r\n`);
    parts.push(blob);
    parts.push(`\r\n`);
  }
  parts.push(`--${boundary}--`);
  return new Blob(parts, { type: `multipart/mixed; boundary=${boundary}` });
}

export async function getSettings<T=unknown>(): Promise<T | null> {
  const db = await openDb();
  const store = await getStore(db, 'settings');
  const v = await request(store.get('settings'));
  return (v as T) ?? null;
}

export async function setSettings<T=unknown>(value: T): Promise<void> {
  const db = await openDb();
  const store = await getStore(db, 'settings', 'readwrite');
  await request(store.put(value, 'settings'));
}

export async function getTmdbCached(keyHash: string): Promise<TmdbCacheRecord | null> {
  const db = await openDb();
  const store = await getStore(db, 'tmdbCache');
  const v = await request(store.get(keyHash));
  if (!v) return null;
  const rec = v as TmdbCacheRecord;
  const ageHrs = (Date.now() - rec.createdAt) / 36e5;
  if (ageHrs > rec.ttlHours) {
    // expired
    await deleteTmdb(keyHash);
    return null;
  }
  return rec;
}

export async function setTmdbCached(rec: TmdbCacheRecord): Promise<void> {
  const db = await openDb();
  const store = await getStore(db, 'tmdbCache', 'readwrite');
  await request(store.put(rec));
  await enforceQuota(db);
}

export async function deleteTmdb(keyHash: string): Promise<void> {
  const db = await openDb();
  const store = await getStore(db, 'tmdbCache', 'readwrite');
  await request(store.delete(keyHash));
}

// Helpers
function request<T=unknown>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function getLast(index: IDBIndex): Promise<{ sessionId: string; record: SessionRecord } | null> {
  return new Promise((resolve, reject) => {
    const cursorReq = index.openCursor(null, 'prev');
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result as IDBCursorWithValue | null;
      if (cursor) {
        resolve({ sessionId: (cursor.value as { sessionId: string }).sessionId, record: cursor.value as SessionRecord });
      } else {
        resolve(null);
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

async function computeDbSize(db: IDBDatabase): Promise<number> {
  const store = await getStore(db, 'sessions');
  const all: unknown[] = await request((store as unknown as { getAll: () => IDBRequest }).getAll());
  const sessBytes = new Blob([JSON.stringify(all)]).size;
  const tmdbStore = await getStore(db, 'tmdbCache');
  const allTmdb: unknown[] = await request((tmdbStore as unknown as { getAll: () => IDBRequest }).getAll());
  const tmdbBytes = new Blob([JSON.stringify(allTmdb)]).size;
  return sessBytes + tmdbBytes;
}

async function enforceQuota(db: IDBDatabase) {
  let size = await computeDbSize(db);
  if (size <= QUOTA_BYTES) return;
  // LRU deletion from sessions then tmdbCache
  const sessions = await getStore(db, 'sessions', 'readwrite');
  const sIdx = sessions.index('createdAt');
  await deleteOldest(sIdx, () => size <= QUOTA_BYTES, async (rec: unknown) => {
    size -= new Blob([JSON.stringify(rec as unknown)]).size;
  });
  if (size > QUOTA_BYTES) {
    const tmdb = await getStore(db, 'tmdbCache', 'readwrite');
    const tIdx = tmdb.index('createdAt');
    await deleteOldest(tIdx, () => size <= QUOTA_BYTES, async (rec: unknown) => {
      size -= new Blob([JSON.stringify(rec as unknown)]).size;
    });
  }
}

async function deleteOldest(index: IDBIndex, done: () => boolean, after: (rec: unknown) => Promise<void>) {
  await new Promise<void>((resolve, reject) => {
    const cursorReq = index.openCursor();
    cursorReq.onsuccess = async () => {
      let cursor = cursorReq.result as IDBCursorWithValue | null;
      while (cursor && !done()) {
        const rec = cursor.value;
        cursor.delete();
        await after(rec);
        cursor.continue();
        cursor = cursor; // keep reference for TS
      }
      resolve();
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}
