const DB_NAME = "idle-formation";
const STORE_NAME = "saves";
const SAVE_KEY = "main";
const LOCAL_STORAGE_KEY = "idle-formation-save";

export async function loadSave() {
  try {
    const db = await openDb();
    return await requestToPromise(db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SAVE_KEY));
  } catch (error) {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }
}

export async function saveGame(state) {
  const payload = JSON.parse(JSON.stringify({ ...state, lastSavedAt: Date.now() }));
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(payload, SAVE_KEY);
    await transactionToPromise(transaction);
  } catch (error) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  }
}

export async function clearSave() {
  try {
    const db = await openDb();
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(SAVE_KEY);
    await transactionToPromise(transaction);
  } catch (error) {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result ?? null);
  });
}

function transactionToPromise(transaction) {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}
