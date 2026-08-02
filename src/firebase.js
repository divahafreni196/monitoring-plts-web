/**
 * firebase.js — Lapisan akses data Firebase Realtime Database.
 * Menyimpan konfigurasi Firebase (diambil dari variabel env), menginisialisasi
 * aplikasi & database, lalu menyediakan fungsi umum:
 * - initFirebase()      : inisialisasi koneksi Firebase.
 * - listenRealtime()    : mendengarkan (subscribe) perubahan data secara realtime.
 * - fetchData()         : mengambil data sekali (get), mendukung orderBy/limit.
 * - deleteData()        : menghapus data pada suatu path.
 * - writeData()         : menulis/menimpa data pada suatu path.
 * - addTelegramUser()   : menambah pengguna Telegram baru.
 * Semua modul lain berkomunikasi dengan Firebase melalui file ini.
 */
import { initializeApp, getApps } from 'firebase/app'; // Inisialisasi app Firebase
import { getDatabase, ref, onValue, get, query, orderByChild, limitToLast, remove, push, set } from 'firebase/database'; // API Realtime Database

// Konfigurasi Firebase dari variabel env (.env), dengan nilai placeholder default
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'ISI_API_KEY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ISI_AUTH_DOMAIN',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://monitoring-plts-dipa-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ISI_PROJECT_ID',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ISI_STORAGE_BUCKET',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'ISI_MESSAGING_SENDER_ID',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || 'ISI_APP_ID'
};

let app = null; // Instance aplikasi Firebase
let db = null;  // Instance database

// Inisialisasi koneksi Firebase (dipanggil otomatis oleh fungsi lain)
export function initFirebase() {
  if (db) return; // Sudah terinisialisasi
  if (FIREBASE_CONFIG.apiKey === 'ISI_API_KEY') {
    console.error('Firebase not configured. Copy .env.example to .env and fill values.');
    return; // Konfigurasi belum diisi, berhenti
  }
  app = getApps().length === 0 ? initializeApp(FIREBASE_CONFIG) : getApps()[0]; // Gunakan app yang sudah ada bila perlu
  db = getDatabase(app);
}

// Mendengarkan perubahan data pada path secara realtime; mengembalikan fungsi unsubscribe
export function listenRealtime(path, callback) {
  initFirebase();
  if (!db) { callback(null, new Error('Firebase not configured')); return () => {}; }
  const dbRef = ref(db, path); // Referensi lokasi data
  const unsubscribe = onValue(dbRef, // Berlangganan perubahan
    (snapshot) => callback(snapshot.val()), // Panggil callback dengan nilai terbaru
    (error) => { console.error(error); callback(null, error); } // Tangani error
  );
  return unsubscribe;
}

// Mengambil data sekali (get), dengan opsi orderBy dan limit
export async function fetchData(path, options = {}) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  let q = ref(db, path);
  const constraints = []; // Kumpulan batasan query
  if (options.orderBy) {
    constraints.push(orderByChild(options.orderBy)); // Urutkan berdasarkan child
    if (options.limit) constraints.push(limitToLast(options.limit)); // Ambil N data terakhir
  } else if (options.limit) {
    constraints.push(limitToLast(options.limit));
  }
  if (constraints.length) q = query(q, ...constraints); // Terapkan query
  const snap = await get(q);
  return snap.val(); // Nilai data (objek/null)
}

// Menghapus seluruh data pada path tertentu
export async function deleteData(path) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  await remove(ref(db, path)); // remove() menghapus node beserta turunannya
}

// Menulis / menimpa nilai pada path tertentu
export async function writeData(path, value) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  await set(ref(db, path), value);
}

// Menambah pengguna Telegram baru (membuat key acak dengan push)
export async function addTelegramUser(userData) {
  initFirebase();
  if (!db) throw new Error('Firebase not configured');
  const newRef = push(ref(db, 'telegram_users')); // Key unik baru
  await set(newRef, userData);
  return newRef.key; // Kembalikan key data baru
}
