/**
 * hooks.js — Kumpulan custom hooks React untuk kebutuhan data aplikasi.
 * - useRealtimeData()   : data realtime ESP32 (esp32/realtime).
 * - useConfigData()     : konfigurasi batas tegangan dari database (esp32/konfigurasi);
 *   satu-satunya sumber batas min/max untuk semua halaman (Dashboard, gauge, notifikasi).
 * - useHistoryData()    : riwayat data lengkap (esp32/riwayat), realtime + refresh manual.
 * - useAbnormalData()   : data kejadian abnormal (esp32/abnormal), realtime + refresh.
 * - useChartBuffer()    : buffer 25 titik terakhir untuk grafik realtime (dengan backfill).
 * - useTelegramUsers()  : daftar pengguna Telegram terdaftar (telegram_users).
 * - useTelegramMonitor(): pemantau kejadian abnormal baru; mengirim notifikasi Telegram
 *   ke semua pengguna terdaftar (dengan anti-spam per kunci data) dan polling perintah
 *   /start dari bot.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { listenRealtime, fetchData } from './firebase';
import { sendTelegramMessage, formatAbnormalMessage, processStartCommands, hasBotToken } from './telegram';

// Data realtime ESP32: berlangganan esp32/realtime, perbarui state tiap ada perubahan
export function useRealtimeData() {
  const [data, setData] = useState(null); // Nilai data terbaru
  const [error, setError] = useState(null); // Error listener

  useEffect(() => {
    const unsub = listenRealtime('esp32/realtime', (val, err) => {
      if (err) { setError(err); return; } // Simpan error bila gagal
      setData(val);
    });
    return () => unsub(); // Berhenti berlangganan saat komponen unmount
  }, []);

  return { data, error };
}

// Konfigurasi batas tegangan dari database esp32/konfigurasi.
// Menjadi sumber batas min/max untuk seluruh halaman (nilai awal 200-240 V = default DB).
export function useConfigData() {
  const [config, setConfig] = useState({ batas_minimum: 200, batas_maximum: 240 });

  useEffect(() => {
    const unsub = listenRealtime('esp32/konfigurasi', (val, err) => {
      if (err || !val || typeof val !== 'object') return; // Abaikan data invalid
      setConfig(prev => {
        const next = { ...prev };
        // Perbarui hanya field yang tersedia & bukan null
        if (val.batas_minimum !== undefined && val.batas_minimum !== null) next.batas_minimum = Number(val.batas_minimum);
        if (val.batas_maximum !== undefined && val.batas_maximum !== null) next.batas_maximum = Number(val.batas_maximum);
        return next;
      });
    });
    return () => unsub();
  }, []);

  return config;
}

// Data riwayat lengkap (esp32/riwayat): realtime + fungsi refresh manual
export function useHistoryData() {
  const [data, setData] = useState([]); // Array entri riwayat (terurut terbaru dulu)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Muat ulang data secara manual (fetch sekali)
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchData('esp32/riwayat');
      if (raw && typeof raw === 'object') {
        const entries = [];
        // Ubah objek {key: value} menjadi array dengan properti _key
        for (const [key, val] of Object.entries(raw)) {
          entries.push({ _key: key, ...val });
        }
        entries.sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0)); // Terbaru dulu
        setData(entries);
      } else {
        setData([]); // Belum ada data
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Langganan realtime: riwayat selalu mutakhir
  useEffect(() => {
    setLoading(true);
    const unsub = listenRealtime('esp32/riwayat', (val, err) => {
      if (err) { setError(err.message); setLoading(false); return; }
      if (val && typeof val === 'object') {
        const entries = [];
        for (const [key, v] of Object.entries(val)) {
          entries.push({ _key: key, ...v });
        }
        entries.sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0));
        setData(entries);
      } else {
        setData([]);
      }
      setError(null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { data, loading, error, refresh: load };
}

// Data kejadian abnormal (esp32/abnormal): realtime + refresh manual
export function useAbnormalData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchData('esp32/abnormal', { limit: 100 }); // Maks. 100 data terakhir
      if (raw && typeof raw === 'object') {
        const arr = Object.entries(raw)
          .map(([key, v]) => ({ _key: key, ...v }))
          .sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0));
        setData(arr);
      } else {
        setData([]);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsub = listenRealtime('esp32/abnormal', (val, err) => {
      if (err) { setError(err.message); setLoading(false); return; }
      if (val && typeof val === 'object') {
        const arr = Object.entries(val)
          .map(([key, v]) => ({ _key: key, ...v }))
          .sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0));
        setData(arr);
      } else {
        setData([]);
      }
      setError(null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { data, loading, error, refresh: load };
}

// Buffer grafik realtime: simpan maksimal 25 titik terakhir di memori
export function useChartBuffer() {
  const [points, setPoints] = useState([]); // Titik yang dirender ke grafik
  const buffer = useRef([]); // Penyimpanan sementara (ref agar stabil antar render)

  // Tambah satu titik data baru; buang titik terlama bila melebihi 25
  const addPoint = useCallback((entry) => {
    buffer.current.push({
      measured_at: entry.measured_at || entry.received_at || Date.now(), // Waktu pengukuran
      voltage: entry.voltage,
      current: entry.current,
      power: entry.power,
      energy: entry.energy,
      frequency: entry.frequency,
      power_factor: entry.power_factor
    });
    if (buffer.current.length > 25) buffer.current.shift(); // Buang data terlama
    setPoints([...buffer.current]); // Salin array agar React mendeteksi perubahan
  }, []);

  // Backfill: isi buffer dengan 25 riwayat terakhir (saat halaman pertama dibuka)
  const backfill = useCallback(async () => {
    try {
      const raw = await fetchData('esp32/riwayat', { orderBy: 'measured_at', limit: 25 });
      if (raw && typeof raw === 'object') {
        const entries = Object.values(raw).sort((a, b) => (a.measured_at || 0) - (b.measured_at || 0)); // Urut menaik (tertua dulu)
        buffer.current = entries.map(e => ({
          measured_at: e.measured_at || e.received_at || Date.now(),
          voltage: e.voltage, current: e.current, power: e.power,
          energy: e.energy, frequency: e.frequency, power_factor: e.power_factor
        }));
        setPoints([...buffer.current]);
      }
    } catch {} // Gagal mengambil riwayat: abaikan, grafik tetap kosong
  }, []);

  return { points, addPoint, backfill };
}

// Daftar pengguna Telegram terdaftar (telegram_users)
export function useTelegramUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = listenRealtime('telegram_users', (val, err) => {
      if (err || !val || typeof val !== 'object') { setUsers([]); return; } // Data tidak valid
      setUsers(Object.entries(val).map(([key, u]) => ({ _key: key, ...u })));
    });
    return () => unsub();
  }, []);

  return users;
}

// Pemantau kejadian abnormal untuk notifikasi Telegram
export function useTelegramMonitor({ config }) {
  const [lastStatus, setLastStatus] = useState('NORMAL'); // Status terakhir yang dilaporkan
  const [alerting, setAlerting] = useState(false); // Sedang mengirim notifikasi?
  const [log, setLog] = useState([]); // Log notifikasi (maks. 100 entri)
  const initializedRef = useRef(false); // Penanda inisialisasi pertama listener
  const notifiedKeysRef = useRef(new Set()); // Key abnormal yang sudah dinotifikasi (anti-spam)
  const limitsRef = useRef({ minV: 200, maxV: 240 }); // Batas tegangan terbaru

  // Batas min/max diambil dari database (esp32/konfigurasi via useConfigData) — fallback default DB
  const minV = Number(config?.batas_minimum) || 200;
  const maxV = Number(config?.batas_maximum) || 240;
  limitsRef.current = { minV, maxV }; // Simpan batas terbaru untuk dipakai di listener

  // Tambah entri log (pesan baru selalu di paling atas)
  const pushLog = useCallback((msg, type = 'ok') => {
    setLog(prev => [{ id: `${Date.now()}-${Math.random()}`, msg, type, time: new Date() }, ...prev].slice(0, 100));
  }, []);

  // Format timestamp menjadi "YYYY-MM-DD HH:mm:ss" zona WIB
  const formatWIB = (ts) => {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const time = d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return `${date} ${time}`;
  };

  // Listener kejadian abnormal: kirim notifikasi hanya untuk kejadian BARU
  useEffect(() => {
    if (!hasBotToken()) {
      pushLog('⚠️ VITE_TELEGRAM_BOT_TOKEN belum diisi di .env. Notifikasi tidak akan terkirim.', 'warn');
      return; // Token kosong: tidak ada pemantauan
    }
    const unsub = listenRealtime('esp32/abnormal', (val, err) => {
      if (err) { pushLog(`Listener abnormal error: ${err.message}`, 'err'); return; }
      if (!val || typeof val !== 'object') return;

      // Urutkan kejadian dari terbaru
      const entries = Object.entries(val)
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0));
      if (entries.length === 0) return;

      // Hapus key lama yang sudah tidak ada (kejadian dihapus) dari set ter-notifikasi
      const currentKeys = new Set(entries.map(e => e.key));
      const notifiedKeys = notifiedKeysRef.current;
      for (const key of [...notifiedKeys]) {
        if (!currentKeys.has(key)) notifiedKeys.delete(key);
      }

      // Inisialisasi pertama: tandai semua kejadian lama sebagai sudah dinotifikasi
      if (!initializedRef.current) {
        initializedRef.current = true;
        entries.forEach(e => notifiedKeys.add(e.key));
        pushLog(`👂 Listener abnormal aktif. ${entries.length} kejadian lama tidak dikirim ulang.`);
        return;
      }

      // Kejadian baru = yang belum ada di set ter-notifikasi
      const newEntries = entries.filter(e => !notifiedKeys.has(e.key));
      if (newEntries.length === 0) return; // Tidak ada yang baru

      newEntries.forEach(e => notifiedKeys.add(e.key)); // Tandai sebagai sudah dinotifikasi

      const { minV, maxV } = limitsRef.current;
      const ev = newEntries[0];
      if (ev.status) setLastStatus(String(ev.status).toUpperCase()); // Perbarui status terakhir

      setAlerting(true); // Mulai proses kirim
      (async () => {
        try {
          const raw = await fetchData('telegram_users');
          const allUsers = raw ? Object.values(raw) : []; // Semua penerima
          if (allUsers.length === 0) {
            pushLog(`⚠️ Kejadian abnormal baru, tapi tidak ada pengguna terdaftar.`, 'warn');
            return;
          }
          let sent = 0;
          for (const entry of newEntries) {
            // Status: dari data, atau hitung dari tegangan vs batas
            const evStatus = entry.status ? String(entry.status).toUpperCase() : null;
            const status = evStatus || (entry.voltage != null
              ? entry.voltage < minV ? 'UNDER VOLTAGE'
                : entry.voltage > maxV ? 'OVER VOLTAGE'
                : 'NORMAL'
              : 'NORMAL');
            if (status === 'NORMAL') continue; // Bukan abnormal: lewati
            const text = formatAbnormalMessage({ // Susun teks pesan
              status,
              voltage: entry.voltage != null ? Number(entry.voltage).toFixed(1) : '---',
              minV,
              maxV,
              current: entry.current != null ? Number(entry.current).toFixed(2) : '---',
              power: entry.power != null ? Number(entry.power).toFixed(0) : '---',
              time: formatWIB(entry.measured_at || Date.now())
            });
            // Kirim ke semua pengguna terdaftar
            for (const u of allUsers) {
              const chatId = u.chatid || u.chat_id;
              if (!chatId) continue; // Pengguna tanpa chat_id dilewati
              try {
                await sendTelegramMessage(chatId, text);
                sent++;
              } catch (e) {
                pushLog(`Gagal kirim ke ${chatId}: ${e.message}`, 'err');
              }
            }
          }
          pushLog(`📤 NOTIFIKASI abnormal baru (${newEntries.length} kejadian) terkirim ke ${sent}/${allUsers.length} pengguna.`);
        } catch (e) {
          pushLog(`Gagal kirim notifikasi: ${e.message}`, 'err');
        } finally {
          setAlerting(false); // Selesai mengirim
        }
      })();
    });
    return () => unsub();
  }, [pushLog]);

  // Polling perintah /start dari bot setiap 15 detik (mendaftarkan pengguna baru)
  useEffect(() => {
    if (!hasBotToken()) return;
    let cancelled = false; // Penanda pembatalan saat unmount
    const poll = async () => {
      try {
        const registered = await processStartCommands();
        registered.forEach(u => pushLog(`📥 /start diterima dari ${u.first_name} (chat_id ${u.chat_id}) — balasan terkirim.`));
      } catch (e) {
        if (!cancelled) pushLog(`Cek /start gagal: ${e.message}`, 'err');
      }
    };
    poll(); // Jalankan langsung saat komponen mount
    const iv = setInterval(poll, 15000); // Lalu ulangi tiap 15 detik
    return () => { cancelled = true; clearInterval(iv); }; // Bersihkan interval
  }, [pushLog]);

  return { lastStatus, alerting, log, tokenConfigured: hasBotToken() };
}
