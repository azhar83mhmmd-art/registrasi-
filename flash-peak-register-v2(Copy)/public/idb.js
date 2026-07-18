// ============================================
// IndexedDB helper — local persistence for members
// (mirrors server state client-side, no external deps)
// ============================================

const FP_DB_NAME = 'flashpeak-db';
const FP_DB_VERSION = 1;
const FP_STORE = 'members';

function fpOpenDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(FP_DB_NAME, FP_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FP_STORE)) {
        db.createObjectStore(FP_STORE, { keyPath: 'memberId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fpSaveMembers(members) {
  const db = await fpOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FP_STORE, 'readwrite');
    const store = tx.objectStore(FP_STORE);
    members.forEach((m) => store.put(m));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function fpGetAllMembers() {
  const db = await fpOpenDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FP_STORE, 'readonly');
    const store = tx.objectStore(FP_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
