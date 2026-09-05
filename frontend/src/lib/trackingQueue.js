// Offline-safe GPS queue (IndexedDB). Stores unsent observations locally so a
// driver keeps collecting GPS while offline and uploads later in original
// timestamp order. gps_timestamp is NEVER rewritten during sync.

const DB_NAME = 'raahi_tracking';
const STORE = 'pending_points';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('gps_timestamp', 'gps_timestamp');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export const trackingQueue = {
  async enqueue(point) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).add({ ...point, queuedAt: new Date().toISOString(), status: 'PENDING' });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch (e) {
      console.warn('[TRACKING] Could not queue point (IDB unavailable):', e.message);
      return false;
    }
  },

  async getAll() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch { return []; }
  },

  async count() {
    try {
      const all = await this.getAll();
      return all.length;
    } catch { return 0; }
  },

  async remove(ids) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        ids.forEach(id => store.delete(id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.warn('[TRACKING] Queue removal failed:', e.message);
    }
  },
};

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
