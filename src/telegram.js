/**
 * telegram.js — Integrasi bot Telegram untuk notifikasi PLTS.
 * - hasBotToken()           : cek apakah token bot sudah diisi di .env.
 * - sendTelegramMessage()   : mengirim pesan (HTML) ke chat_id tertentu via Bot API.
 * - getTelegramUpdates()    : mengambil update (pesan masuk) dari bot.
 * - formatAbnormalMessage() : menyusun teks pesan peringatan abnormal (status, tegangan,
 *                             batas, arus, daya, waktu).
 * - registerTelegramUser()  : mendaftarkan/memperbarui pengguna + kirim pesan sukses.
 * - processStartCommands()  : polling perintah /start dan mendaftarkan pengguna baru.
 */
import { fetchData, writeData, addTelegramUser } from './firebase';

const TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || ''; // Token bot Telegram dari .env
const API = 'https://api.telegram.org/bot'; // URL dasar Bot API Telegram

// Cek apakah token bot sudah diisi (bukan kosong / placeholder)
export function hasBotToken() {
  return TOKEN !== '' && TOKEN !== 'ISI_TELEGRAM_BOT_TOKEN';
}

// Pesan yang dikirim saat pengguna pertama kali mendaftar via /start
export const REGISTRATION_SUCCESS = `✅ Registrasi berhasil.

Anda akan menerima notifikasi apabila terjadi gangguan sistem PLTS.`;

let lastUpdateId = 0; // ID update terakhir yang sudah diproses (offset polling)

// Kirim pesan ke chat tertentu via Bot API (format HTML)
export async function sendTelegramMessage(chatId, text, parseMode = 'HTML') {
  if (!hasBotToken()) throw new Error('VITE_TELEGRAM_BOT_TOKEN belum diisi di .env');
  const res = await fetch(`${API}${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: parseMode })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Gagal mengirim pesan Telegram'); // API mengembalikan error
  return data.result;
}

// Ambil update (pesan masuk) dari bot, hanya update yang lebih baru dari lastUpdateId
export async function getTelegramUpdates() {
  if (!hasBotToken()) return [];
  const res = await fetch(`${API}${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Gagal mengambil update');
  const updates = data.result || [];
  if (updates.length) lastUpdateId = updates[updates.length - 1].update_id; // Geser offset ke update terakhir
  return updates;
}

// Susun teks pesan peringatan abnormal (status, tegangan, batas, arus, daya, waktu)
export function formatAbnormalMessage({ status, voltage, minV, maxV, current, power, time }) {
  const isOver = status === 'OVER VOLTAGE'; // Tentukan batas mana yang ditampilkan
  return [
    '⚠️ PERINGATAN PLTS',
    '',
    `Status : ${status}`,
    '',
    `Tegangan : ${voltage} V`,
    `Batas ${isOver ? 'maksimum' : 'minimum'} : ${isOver ? maxV : minV} V`,
    '',
    `Arus : ${current} A`,
    `Daya : ${power} W`,
    '',
    `Waktu : ${time}`
  ].join('\n');
}

// Cari key pengguna Telegram berdasarkan chat_id
async function findUserKeyByChatId(chatId) {
  const users = await fetchData('telegram_users');
  if (!users) return null;
  for (const [key, u] of Object.entries(users)) {
    if (String(u.chatid || u.chat_id) === String(chatId)) return key; // Cocok ditemukan
  }
  return null;
}

// Daftarkan pengguna baru / perbarui data pengguna, lalu kirim pesan sukses
export async function registerTelegramUser({ chat_id, username, first_name }) {
  const userData = {
    chatid: String(chat_id),
    username: username || '',
    nama: first_name || '',
    tanggal_daftar: new Date().toISOString()
  };
  const key = await findUserKeyByChatId(chat_id);
  if (key) {
    await writeData(`telegram_users/${key}`, userData); // Sudah ada: perbarui
  } else {
    await addTelegramUser(userData); // Baru: tambahkan
  }
  await sendTelegramMessage(chat_id, REGISTRATION_SUCCESS);
  return { chat_id, first_name: first_name || username || String(chat_id) };
}

// Polling perintah /start dari bot; daftarkan pengguna baru yang menekan /start
export async function processStartCommands() {
  const updates = await getTelegramUpdates();
  const registered = [];
  for (const upd of updates) {
    const msg = upd.message;
    if (!msg || String(msg.text || '').trim() !== '/start') continue; // Bukan perintah /start
    const from = msg.from || {};
    const chatId = msg.chat?.id ?? from.id;
    if (chatId == null) continue; // Tanpa chat_id, dilewati
    const user = await registerTelegramUser({
      chat_id: chatId,
      username: from.username,
      first_name: from.first_name
    });
    registered.push(user);
  }
  return registered;
}
