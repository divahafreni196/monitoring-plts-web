import { useState, useEffect, useCallback, useRef } from 'react';
import { listenRealtime, fetchData } from './firebase';
import { sendTelegramMessage, formatAbnormalMessage, processStartCommands, hasBotToken } from './telegram';

export function useRealtimeData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsub = listenRealtime('esp32/realtime', (val, err) => {
      if (err) { setError(err); return; }
      setData(val);
    });
    return () => unsub();
  }, []);

  return { data, error };
}

export function useConfigData() {
  const [config, setConfig] = useState({ batas_minimum: 200, batas_maximum: 240 });

  useEffect(() => {
    const unsub = listenRealtime('esp32/konfigurasi', (val, err) => {
      if (err || !val || typeof val !== 'object') return;
      setConfig(prev => {
        const next = { ...prev };
        if (val.batas_minimum !== undefined && val.batas_minimum !== null) next.batas_minimum = Number(val.batas_minimum);
        if (val.batas_maximum !== undefined && val.batas_maximum !== null) next.batas_maximum = Number(val.batas_maximum);
        return next;
      });
    });
    return () => unsub();
  }, []);

  return config;
}

export function useHistoryData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchData('esp32/riwayat');
      if (raw && typeof raw === 'object') {
        const entries = [];
        for (const [key, val] of Object.entries(raw)) {
          entries.push({ _key: key, ...val });
        }
        entries.sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0));
        setData(entries);
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

export function useAbnormalData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await fetchData('esp32/abnormal', { limit: 100 });
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

export function useChartBuffer() {
  const [points, setPoints] = useState([]);
  const buffer = useRef([]);

  const addPoint = useCallback((entry) => {
    buffer.current.push({
      measured_at: entry.measured_at || entry.received_at || Date.now(),
      voltage: entry.voltage,
      current: entry.current,
      power: entry.power,
      energy: entry.energy,
      frequency: entry.frequency,
      power_factor: entry.power_factor
    });
    if (buffer.current.length > 25) buffer.current.shift();
    setPoints([...buffer.current]);
  }, []);

  const backfill = useCallback(async () => {
    try {
      const raw = await fetchData('esp32/riwayat', { orderBy: 'measured_at', limit: 25 });
      if (raw && typeof raw === 'object') {
        const entries = Object.values(raw).sort((a, b) => (a.measured_at || 0) - (b.measured_at || 0));
        buffer.current = entries.map(e => ({
          measured_at: e.measured_at || e.received_at || Date.now(),
          voltage: e.voltage, current: e.current, power: e.power,
          energy: e.energy, frequency: e.frequency, power_factor: e.power_factor
        }));
        setPoints([...buffer.current]);
      }
    } catch {}
  }, []);

  return { points, addPoint, backfill };
}

export function useTelegramUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = listenRealtime('telegram_users', (val, err) => {
      if (err || !val || typeof val !== 'object') { setUsers([]); return; }
      setUsers(Object.entries(val).map(([key, u]) => ({ _key: key, ...u })));
    });
    return () => unsub();
  }, []);

  return users;
}

export function useTelegramMonitor({ config }) {
  const [lastStatus, setLastStatus] = useState('NORMAL');
  const [alerting, setAlerting] = useState(false);
  const [log, setLog] = useState([]);
  const initializedRef = useRef(false);
  const notifiedKeysRef = useRef(new Set());
  const limitsRef = useRef({ minV: 200, maxV: 240 });

  const minV = Number(config?.batas_minimum) || 200;
  const maxV = Number(config?.batas_maximum) || 240;
  limitsRef.current = { minV, maxV };

  const pushLog = useCallback((msg, type = 'ok') => {
    setLog(prev => [{ id: `${Date.now()}-${Math.random()}`, msg, type, time: new Date() }, ...prev].slice(0, 100));
  }, []);

  const formatWIB = (ts) => {
    const d = new Date(ts);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const time = d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta', hour12: false,
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    return `${date} ${time}`;
  };

  useEffect(() => {
    if (!hasBotToken()) {
      pushLog('⚠️ VITE_TELEGRAM_BOT_TOKEN belum diisi di .env. Notifikasi tidak akan terkirim.', 'warn');
      return;
    }
    const unsub = listenRealtime('esp32/abnormal', (val, err) => {
      if (err) { pushLog(`Listener abnormal error: ${err.message}`, 'err'); return; }
      if (!val || typeof val !== 'object') return;

      const entries = Object.entries(val)
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0));
      if (entries.length === 0) return;

      const currentKeys = new Set(entries.map(e => e.key));
      const notifiedKeys = notifiedKeysRef.current;
      for (const key of [...notifiedKeys]) {
        if (!currentKeys.has(key)) notifiedKeys.delete(key);
      }

      if (!initializedRef.current) {
        initializedRef.current = true;
        entries.forEach(e => notifiedKeys.add(e.key));
        pushLog(`👂 Listener abnormal aktif. ${entries.length} kejadian lama tidak dikirim ulang.`);
        return;
      }

      const newEntries = entries.filter(e => !notifiedKeys.has(e.key));
      if (newEntries.length === 0) return;

      newEntries.forEach(e => notifiedKeys.add(e.key));

      const { minV, maxV } = limitsRef.current;
      const ev = newEntries[0];
      if (ev.status) setLastStatus(String(ev.status).toUpperCase());

      setAlerting(true);
      (async () => {
        try {
          const raw = await fetchData('telegram_users');
          const allUsers = raw ? Object.values(raw) : [];
          if (allUsers.length === 0) {
            pushLog(`⚠️ Kejadian abnormal baru, tapi tidak ada pengguna terdaftar.`, 'warn');
            return;
          }
          let sent = 0;
          for (const entry of newEntries) {
            const evStatus = entry.status ? String(entry.status).toUpperCase() : null;
            const status = evStatus || (entry.voltage != null
              ? entry.voltage < minV ? 'UNDER VOLTAGE'
                : entry.voltage > maxV ? 'OVER VOLTAGE'
                : 'NORMAL'
              : 'NORMAL');
            if (status === 'NORMAL') continue;
            const text = formatAbnormalMessage({
              status,
              voltage: entry.voltage != null ? Number(entry.voltage).toFixed(1) : '---',
              minV,
              maxV,
              current: entry.current != null ? Number(entry.current).toFixed(2) : '---',
              power: entry.power != null ? Number(entry.power).toFixed(0) : '---',
              time: formatWIB(entry.measured_at || Date.now())
            });
            for (const u of allUsers) {
              const chatId = u.chatid || u.chat_id;
              if (!chatId) continue;
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
          setAlerting(false);
        }
      })();
    });
    return () => unsub();
  }, [pushLog]);

  useEffect(() => {
    if (!hasBotToken()) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const registered = await processStartCommands();
        registered.forEach(u => pushLog(`📥 /start diterima dari ${u.first_name} (chat_id ${u.chat_id}) — balasan terkirim.`));
      } catch (e) {
        if (!cancelled) pushLog(`Cek /start gagal: ${e.message}`, 'err');
      }
    };
    poll();
    const iv = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [pushLog]);

  return { lastStatus, alerting, log, tokenConfigured: hasBotToken() };
}
