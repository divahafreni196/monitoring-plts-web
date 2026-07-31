import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, onValue, get, query, orderByChild, limitToLast, remove, push, set } from 'firebase/database';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'ISI_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ISI_AUTH_DOMAIN',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://monitoring-plts-dipa-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ISI_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ISI_STORAGE_BUCKET',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'ISI_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'ISI_APP_ID'
};

let app = null;
let db = null;

export function initFirebase() {
  if (db) return;
  if (FIREBASE_CONFIG.apiKey === 'ISI_API_KEY') {
    console.error('Firebase not configured. Copy .env.example to .env and fill values.');
    return;
  }
  app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0];
  db = getDatabase(app);
}

export function listenRealtime(path, callback) {
  initFirebase();
  if (!db) { callback(null, new Error('Firebase not configured')); return () => {}; }
  const dbRef = ref(db, path);
  const unsubscribe = onValue(dbRef,
    (snapshot) => callback(snapshot.val()),
    (error) => { console.error(error); callback(null, error); }
  );
  return unsubscribe;
}

export async function fetchData(path, options = {}) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  let q = ref(db, path);
  const constraints = [];
  if (options.orderBy) {
    constraints.push(orderByChild(options.orderBy));
    if (options.limit) constraints.push(limitToLast(options.limit));
  } else if (options.limit) {
    constraints.push(limitToLast(options.limit));
  }
  if (constraints.length) q = query(q, ...constraints);
  const snap = await get(q);
  return snap.val();
}

export async function deleteData(path) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  await remove(ref(db, path));
}

export async function writeData(path, value) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  await set(ref(db, path), value);
}

export async function addTelegramUser(userData) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  const newRef = push(ref(db, 'telegram_users'));
  await set(newRef, userData);
  return newRef.key;
}
