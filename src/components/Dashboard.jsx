/**
 * Dashboard.jsx — Halaman utama (Dashboard).
 * Menampilkan:
 * - Kartu Status Sistem (status ESP32 & waktu pembaruan terakhir).
 * - Kartu Status Tegangan: badge kondisi (UNDER/NORMAL/OVER VOLTAGE) + nilai tegangan.
 * - Gauge Chart tegangan & arus (canvas) dengan batas dari database.
 * - Kartu metrik Daya, Energi, Frekuensi, dan Power Factor.
 * - Grafik realtime (Recharts) untuk semua metrik dari buffer 25 titik.
 * - Ringkasan: total energi, jumlah kejadian abnormal, dan rekapan harian.
 */
import { useMemo } from 'react';
import MetricCard from './MetricCard';        // Kartu statistik metrik (Daya, Energi, dll.)
import GaugeChart from './GaugeChart';        // Gauge canvas untuk tegangan & arus
import RealtimeChart from './RealtimeChart';  // Grafik garis realtime (Recharts)
import { getEspStatus, getVoltageStatus, fmt, formatDateTime } from '../utils';
import { useHistoryData } from '../hooks';    // Data riwayat untuk rekapan harian

// Metrik yang ditampilkan sebagai gauge chart
const GAUGE_METRICS = ['voltage', 'current'];
// Metrik yang ditampilkan sebagai grafik garis realtime
const CHART_METRICS = ['voltage', 'current', 'power', 'energy', 'frequency', 'powerFactor'];

// Warna aksen tiap metrik (dipakai untuk dot pada header chart)
const COLORS = {
  voltage: '#2563eb', current: '#f59e0b', power: '#10b981',
  energy: '#8b5cf6', frequency: '#06b6d4', powerFactor: '#ec4899'
};
// Label (nama) tiap metrik dalam Bahasa Indonesia
const LABELS = {
  voltage: 'Tegangan', current: 'Arus', power: 'Daya',
  energy: 'Energi', frequency: 'Frekuensi', powerFactor: 'PF'
};
// Satuan untuk header chart tiap metrik
const UNITS = {
  voltage: 'V', current: 'A', power: 'W',
  energy: 'kWh', frequency: 'Hz', powerFactor: ''
};

export default function Dashboard({ realtimeData, chartPoints, abnormalCount, config }) {
  const rd = realtimeData; // Alias singkat untuk data realtime ESP32
  // Batas tegangan dari database (esp32/konfigurasi), fallback 200-240 V
  const minV = Number(config?.batas_minimum) || 200;
  const maxV = Number(config?.batas_maximum) || 240;
  const status = getEspStatus(rd?.received_at); // Status online/offline ESP32
  const vStatus = getVoltageStatus(rd?.voltage, minV, maxV); // Kondisi tegangan saat ini
  const lastUpdate = formatDateTime(rd?.received_at); // Waktu pembaruan terakhir (WIB)

  const { data: historyData } = useHistoryData(); // Semua data riwayat untuk rekap harian

  // Ringkasan harian: nilai tertinggi/terendah dari data riwayat hari ini (zona WIB)
  const todaySummary = useMemo(() => {
    const now = new Date();
    const fmtDay = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // Format YYYY-MM-DD zona WIB
    const todayStr = fmtDay(now);
    // Filter data yang tanggalnya (measured_at + 7 jam offset WIB) = hari ini
    const dayData = historyData.filter(d => fmtDay(new Date((d.measured_at || 0) + 7 * 3600000)) === todayStr);
    if (dayData.length === 0) return null; // Tidak ada data hari ini
    let vMax = -Infinity, vMin = Infinity, aMax = -Infinity, pMax = -Infinity;
    for (const d of dayData) {
      // Cari tegangan tertinggi & terendah
      if (d.voltage != null) {
        if (d.voltage > vMax) vMax = d.voltage;
        if (d.voltage < vMin) vMin = d.voltage;
      }
      if (d.current != null && d.current > aMax) aMax = d.current; // Arus tertinggi
      if (d.power != null && d.power > pMax) pMax = d.power;       // Daya tertinggi
    }
    return { vMax, vMin, aMax, pMax, count: dayData.length };
  }, [historyData]);

  return (
    <section className="content-section active">
      {/* ===== Kartu Status Sistem & Status Tegangan ===== */}
      <div className="status-grid">
        <div className="status-card">
          <h2 className="status-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Status Sistem
          </h2>
          {/* Badge status ESP32: Online / Offline / Tidak Diketahui */}
          <div className="status-row"><span className="status-label">ESP32:</span><span className={`status-badge status-${status}`}>{status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Tidak Diketahui'}</span></div>
          <div className="status-row"><span className="status-label">Pembaruan terakhir:</span><span className="status-time">{lastUpdate}</span></div>
        </div>
        <div className="status-card">
          <h2 className="status-card-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Status Tegangan
          </h2>
          {/* Badge kondisi tegangan: badge-low / badge-normal / badge-high / badge-unknown */}
          <div className="status-row"><span className="status-label">Kondisi:</span><span className={`status-badge badge-${vStatus.type}`}>{vStatus.label.toUpperCase()}</span></div>
          <div className="status-row"><span className="status-label">Nilai:</span><span>{fmt(rd?.voltage)} V</span></div>
        </div>
      </div>

      {/* ===== Gauge Chart (Tegangan & Arus) ===== */}
      <div className="charts-section">
        <h2 className="section-subtitle">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
          </svg>
          Gauge Chart
        </h2>
        <div className="gauge-grid">
          {GAUGE_METRICS.map(m => (
            <div key={m} className="gauge-card">
              <div className="chart-header">
                <span className="chart-title">
                  <span className="chart-dot" style={{ background: COLORS[m] }} /> {/* Dot warna metrik */}
                  {LABELS[m]}
                </span>
                {UNITS[m] && <span className="chart-unit">{UNITS[m]}</span>} {/* Satuan metrik */}
              </div>
              {/* Gauge; untuk tegangan dikirim batas min/max dari database */}
              <GaugeChart metric={m} value={rd ? rd[m === 'powerFactor' ? 'power_factor' : m] : null} voltageLimits={m === 'voltage' ? { min: minV, max: maxV } : null} />
            </div>
          ))}
        </div>
      </div>

      {/* ===== Kartu Metrik Ringkas ===== */}
      <div className="dashboard-grid">
        <MetricCard metric="power" label="Daya" value={rd?.power} unit="W" decimals={0} />
        <MetricCard metric="energy" label="Energi" value={rd?.energy} unit="kWh" decimals={3} />
        <MetricCard metric="frequency" label="Frekuensi" value={rd?.frequency} unit="Hz" decimals={1} />
        <MetricCard metric="pf" label="Power Factor" value={rd?.power_factor} decimals={2} />
      </div>

      {/* ===== Grafik Realtime ===== */}
      <div className="charts-section">
        <h2 className="section-subtitle">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Grafik Realtime
        </h2>
        <p className="chart-note">Menampilkan 25 data terbaru di memori lokal.</p>
        <div className="charts-grid">
          {CHART_METRICS.map(m => (
            <div key={m} className="chart-card">
              <div className="chart-header">
                <span className="chart-title">
                  <span className="chart-dot" style={{ background: COLORS[m] }} />
                  {LABELS[m]}
                </span>
                {UNITS[m] && <span className="chart-unit">{UNITS[m]}</span>}
              </div>
              {/* Grafik garis untuk metrik m, sumber data dari chartPoints (buffer) */}
              <RealtimeChart metric={m} data={chartPoints} />
            </div>
          ))}
        </div>
      </div>

      {/* ===== Ringkasan ===== */}
      <div className="summary-section">
        <h2 className="section-subtitle">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Ringkasan
        </h2>
        <div className="summary-grid">
          <div className="summary-card wide-row"><span className="summary-label">Total Energi Saat Ini</span><span className="summary-value">{rd?.energy != null ? Number(rd.energy).toFixed(3) + ' kWh' : '---'}</span></div>
          <div className="summary-card wide-row"><span className="summary-label">Jumlah Kejadian Abnormal</span><span className="summary-value">{abnormalCount}</span></div>
          {/* Rekapan harian hanya muncul jika ada data riwayat hari ini */}
          {todaySummary && (
            <div className="summary-card wide">
              <span className="summary-label">Rekapan Harian</span>
              <table className="summary-table">
                <thead><tr><th>Tegangan Tertinggi</th><th>Tegangan Terendah</th><th>Arus Tertinggi</th><th>Daya Tertinggi</th></tr></thead>
                <tbody>
                  <tr>
                    <td>{Number(todaySummary.vMax).toFixed(1)} V</td>
                    <td>{Number(todaySummary.vMin).toFixed(1)} V</td>
                    <td>{Number(todaySummary.aMax).toFixed(2)} A</td>
                    <td>{Number(todaySummary.pMax).toFixed(0)} W</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
