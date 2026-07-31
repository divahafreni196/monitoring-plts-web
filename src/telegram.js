import { fetchData, writeData, addTelegramUser } from './firebase';

const TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN || '';
const API = 'https://api.telegram.org/bot';

export function hasBotToken() {
  return TOKEN !== '' && TOKEN !== 'ISI_TELEGRAM_BOT_TOKEN';
}

export const REGISTRATION_SUCCESS = `✅ Registrasi berhasil.

Anda akan menerima notifikasi apabila terjadi gangguan sistem PLTS.`;

let lastUpdateId = 0;

export async function sendTelegramMessage(chatId, text, parseMode = 'HTML') {
  if (!hasBotToken()) throw new Error('VITE_TELEGRAM_BOT_TOKEN belum diisi di .env');
  const res = await fetch(`${API}${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: String(chatId), text, parse_mode: parseMode })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Gagal mengirim pesan Telegram');
  return data.result;
}

export async function getTelegramUpdates() {
  if (!hasBotToken()) return [];
  const res = await fetch(`${API}${TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=0`);
  const data = await res.json();
  if (!data.ok) throw new Error(data.description || 'Gagal mengambil update');
  const updates = data.result || [];
  if (updates.length) lastUpdateId = updates[updates.length - 1].update_id;
  return updates;
}

export function formatAbnormalMessage({ status, voltage, minV, maxV, current, power, time }) {
  const isOver = status === 'OVER VOLTAGE';
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

async function findUserKeyByChatId(chatId) {
  const users = await fetchData('telegram_users');
  if (!users) return null;
  for (const [key, u] of Object.entries(users)) {
    if (String(u.chatid || u.chat_id) === String(chatId)) return key;
  }
  return null;
}

export async function registerTelegramUser({ chat_id, username, first_name }) {
  const userData = {
    chatid: String(chat_id),
    username: username || '',
    nama: first_name || '',
    tanggal_daftar: new Date().toISOString()
  };
  const key = await findUserKeyByChatId(chat_id);
  if (key) {
    await writeData(`telegram_users/${key}`, userData);
  } else {
    await addTelegramUser(userData);
  }
  await sendTelegramMessage(chat_id, REGISTRATION_SUCCESS);
  return { chat_id, first_name: first_name || username || String(chat_id) };
}

export async function processStartCommands() {
  const updates = await getTelegramUpdates();
  const registered = [];
  for (const upd of updates) {
    const msg = upd.message;
    if (!msg || String(msg.text || '').trim() !== '/start') continue;
    const from = msg.from || {};
    const chatId = msg.chat?.id ?? from.id;
    if (chatId == null) continue;
    const user = await registerTelegramUser({
      chat_id: chatId,
      username: from.username,
      first_name: from.first_name
    });
    registered.push(user);
  }
  return registered;
}
