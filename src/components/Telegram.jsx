/**
 * Telegram.jsx — Halaman Notifikasi Telegram.
 * - Tombol "Tes Kirim Notifikasi": mengirim pesan uji bertuliskan "Test Notifikasi"
 *   ke semua pengguna terdaftar.
 * - Kartu Status Monitoring: status terakhir, jumlah pengguna terdaftar (total),
 *   dan status kesiapan pengiriman.
 * - Daftar log notifikasi (riwayat kirim, /start diterima, peringatan).
 * Daftar rinci pengguna tidak ditampilkan — hanya total pengguna.
 * Halaman ini tidak menampilkan batas tegangan; batas tegangan yang dipakai
 * notifikasi abnormal berasal dari database (esp32/konfigurasi) lewat monitor.
 */
import { useState } from 'react';
import { useTelegramUsers } from '../hooks';
import { sendTelegramMessage } from '../telegram';
import { formatDateTime } from '../utils';

// Satu entri log: waktu (WIB) + pesan, gaya warna mengikuti tipe (ok/warn/err)
function LogEntry({ entry }) {
  return (
    <li className={`tg-log-item ${entry.type}`}>
      <span className="tg-log-time">{formatDateTime(entry.time.getTime())}</span>
      {entry.msg}
    </li>
  );
}

export default function Telegram({ monitor }) {
  const users = useTelegramUsers(); // Daftar pengguna terdaftar (hanya dihitung totalnya)
  const { lastStatus, alerting, log, tokenConfigured } = monitor; // Status monitor notifikasi
  const [testing, setTesting] = useState(false); // Sedang kirim tes?
  const [testResult, setTestResult] = useState(null); // Hasil tes kirim

  const activeCount = users.length; // Total pengguna terdaftar

  // Kirim pesan uji "Test Notifikasi" ke semua pengguna terdaftar
  const handleTest = async () => {
    if (users.length === 0) { setTestResult('Belum ada pengguna terdaftar.'); return; } // Tanpa penerima
    setTesting(true);
    setTestResult(null);
    const text = 'Test Notifikasi'; // Teks pesan uji
    let sent = 0;
    for (const u of users) {
      try {
        await sendTelegramMessage(u.chatid || u.chat_id, text); // Kirim satu per satu
        sent++;
      } catch (e) {
        setTestResult(`Gagal kirim ke ${u.chatid || u.chat_id}: ${e.message}`);
      }
    }
    setTestResult(sent > 0 ? `Pesan uji terkirim ke ${sent}/${users.length} pengguna. Cek Telegram Anda!` : 'Tidak ada pesan terkirim.');
    setTesting(false);
  };

  return (
    <section className="content-section active">
      {/* Header: judul + tombol tes & badge status bot */}
      <div className="section-header">
        <h2 className="section-subtitle">Notifikasi Telegram</h2>
        <div className="filter-controls">
          {tokenConfigured && (
            <button className="btn btn-primary" onClick={handleTest} disabled={testing}>
              {testing ? 'Mengirim...' : 'Tes Kirim Notifikasi'}
            </button>
          )}
          <span className={`status-badge ${tokenConfigured ? 'badge-normal' : 'badge-low'}`}>
            {tokenConfigured ? 'Bot Aktif' : 'Token Belum Diisi'}
          </span>
        </div>
      </div>

      {/* Hasil tes kirim (sukses/gagal) */}
      {testResult && (
        <div className="error-message" style={{ background: 'var(--success-light)', color: 'var(--success-dark)', marginBottom: 16 }}>
          {testResult}
        </div>
      )}

      {/* Kartu Status Monitoring: status terakhir, total pengguna, kesiapan kirim */}
      <div className="status-grid" style={{ marginBottom: 16 }}>
        <div className="status-card">
          <h2 className="status-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Status Monitoring
          </h2>
          <div className="status-row"><span className="status-label">Status terakhir:</span><span className={`status-badge ${lastStatus === 'NORMAL' ? 'badge-normal' : lastStatus === 'OVER VOLTAGE' ? 'badge-high' : 'badge-low'}`}>{lastStatus}</span></div>
          {/* Total pengguna terdaftar (daftar rinci tidak ditampilkan) */}
          <div className="status-row"><span className="status-label">Pengguna terdaftar:</span><span>{activeCount} pengguna</span></div>
          <div className="status-row"><span className="status-label">Notifikasi:</span><span>{alerting ? 'Mengirim...' : tokenConfigured ? 'Siap kirim' : 'Nonaktif (token kosong)'}</span></div>
        </div>
      </div>

      {/* Log notifikasi */}
      <div className="card-panel">
        <h3 className="card-panel-title">Log Notifikasi</h3>
        {log.length === 0 ? (
          <p className="chart-note">Belum ada aktivitas. Status normal = tidak ada notifikasi (anti-spam aktif).</p>
        ) : (
          <ul className="tg-log">
            {log.map(e => <LogEntry key={e.id} entry={e} />)}
          </ul>
        )}
      </div>
    </section>
  );
}
