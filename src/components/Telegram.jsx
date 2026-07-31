import { useState } from 'react';
import { useTelegramUsers } from '../hooks';
import { sendTelegramMessage, formatAbnormalMessage } from '../telegram';
import { formatDateTime } from '../utils';

function LogEntry({ entry }) {
  return (
    <li className={`tg-log-item ${entry.type}`}>
      <span className="tg-log-time">{formatDateTime(entry.time.getTime())}</span>
      {entry.msg}
    </li>
  );
}

export default function Telegram({ config, monitor }) {
  const users = useTelegramUsers();
  const { lastStatus, alerting, log, tokenConfigured } = monitor;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const activeCount = users.length;

  const handleTest = async () => {
    if (users.length === 0) { setTestResult('Belum ada pengguna terdaftar.'); return; }
    setTesting(true);
    setTestResult(null);
    const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
      + ' ' + new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const text = formatAbnormalMessage({
      status: 'OVER VOLTAGE',
      voltage: '245.5',
      minV: config?.batas_minimum ?? 200,
      maxV: config?.batas_maximum ?? 240,
      current: '1.25',
      power: '300',
      time: now
    });
    let sent = 0;
    for (const u of users) {
      try {
        await sendTelegramMessage(u.chatid || u.chat_id, text);
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

      {testResult && (
        <div className="error-message" style={{ background: 'var(--success-light)', color: 'var(--success-dark)', marginBottom: 16 }}>
          {testResult}
        </div>
      )}

      <div className="status-grid" style={{ marginBottom: 16 }}>
        <div className="status-card">
          <h2 className="status-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Status Monitoring
          </h2>
          <div className="status-row"><span className="status-label">Status terakhir:</span><span className={`status-badge ${lastStatus === 'NORMAL' ? 'badge-normal' : lastStatus === 'OVER VOLTAGE' ? 'badge-high' : 'badge-low'}`}>{lastStatus}</span></div>
          <div className="status-row"><span className="status-label">Pengguna terdaftar:</span><span>{activeCount} pengguna</span></div>
          <div className="status-row"><span className="status-label">Notifikasi:</span><span>{alerting ? 'Mengirim...' : tokenConfigured ? 'Siap kirim' : 'Nonaktif (token kosong)'}</span></div>
        </div>
      </div>

      <div className="card-panel" style={{ marginBottom: 16 }}>
        <h3 className="card-panel-title">Pengguna Terdaftar ({users.length})</h3>
        {users.length === 0 ? (
          <p className="chart-note">Belum ada pengguna. Minta user menekan /start pada bot.</p>
        ) : (
          <div className="table-container">
            <table className="data-table mobile-cards">
              <thead><tr><th>Nama</th><th>Username</th><th>Chat ID</th><th>Tanggal Daftar</th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._key}>
                    <td>{u.nama || u.first_name || '---'}</td>
                    <td data-label="Username">{u.username ? '@' + u.username : '---'}</td>
                    <td data-label="Chat ID">{u.chatid || u.chat_id || '---'}</td>
                    <td data-label="Tanggal Daftar">{u.tanggal_daftar ? formatDateTime(new Date(u.tanggal_daftar).getTime()) : '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
