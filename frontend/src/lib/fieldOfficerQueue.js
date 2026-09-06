// Offline-resilient queue for Field Officer operations (IndexedDB).
// Persists field reports, inspection verifications, and task state updates locally
// when offline or in remote mountainous terrains of Northeast India.
// Actions are synchronized chronologically with UUID idempotency keys upon reconnect.

const DB_NAME = 'raahi_field_officer_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_queue';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('idempotency_key', 'idempotency_key', { unique: true });
        store.createIndex('queued_at', 'queued_at');
        store.createIndex('status', 'status');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'fo-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

export const fieldOfficerQueue = {
  /**
   * Enqueue a pending action (report, verification, or status update)
   */
  async enqueue(type, payload, idempotencyKey = null) {
    try {
      const db = await openDb();
      const key = idempotencyKey || generateUUID();
      const item = {
        type,
        payload,
        idempotency_key: key,
        queued_at: new Date().toISOString(),
        status: 'PENDING',
      };

      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add(item);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      // Notify UI of queue update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('field_queue_updated', { detail: { count: await this.count() } }));
      }
      return key;
    } catch (e) {
      console.warn('[FIELD QUEUE] Could not enqueue item:', e.message);
      return null;
    }
  },

  /**
   * Get all queued pending items
   */
  async getAll() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  },

  /**
   * Get total count of pending items
   */
  async count() {
    try {
      const all = await this.getAll();
      return all.filter((item) => item.status !== 'SYNCED').length;
    } catch {
      return 0;
    }
  },

  /**
   * Remove items by their IDs
   */
  async remove(ids) {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach((id) => store.delete(id));
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('field_queue_updated', { detail: { count: await this.count() } }));
      }
    } catch (e) {
      console.warn('[FIELD QUEUE] Queue removal failed:', e.message);
    }
  },

  /**
   * Clear all items in queue
   */
  async clear() {
    try {
      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('field_queue_updated', { detail: { count: 0 } }));
      }
    } catch {}
  },

  /**
   * Attempt to sync all pending items to the Raahi Core Backend
   */
  async syncNow(apiClient) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { success: false, message: 'Offline - cannot sync now', synced: 0 };
    }

    const items = await this.getAll();
    const pending = items.filter((item) => item.status !== 'SYNCED');
    if (pending.length === 0) {
      return { success: true, message: 'Queue is already empty', synced: 0 };
    }

    try {
      const payloadItems = pending.map((item) => ({
        type: item.type,
        payload: item.payload,
        idempotency_key: item.idempotency_key,
      }));

      const response = await apiClient.syncFieldOfficerBatch(payloadItems);
      if (response && response.success) {
        // Remove successfully processed items
        const idsToRemove = pending.map((item) => item.id);
        await this.remove(idsToRemove);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('field_officer_synced', {
              detail: { count: idsToRemove.length, response },
            })
          );
        }

        return {
          success: true,
          synced: idsToRemove.length,
          data: response.data,
          message: `Synced ${idsToRemove.length} offline records.`,
        };
      } else {
        return {
          success: false,
          synced: 0,
          message: response?.message || 'Sync failed on server',
        };
      }
    } catch (err) {
      return { success: false, synced: 0, message: err.message };
    }
  },
};

// Automatic listener when internet returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', async () => {
    console.log('[FIELD QUEUE] Network online detected. Triggering auto-sync...');
    try {
      const { default: ApiClient } = await import('./api');
      await fieldOfficerQueue.syncNow(ApiClient);
    } catch (e) {
      console.warn('[FIELD QUEUE] Auto-sync attempt failed:', e);
    }
  });
}

