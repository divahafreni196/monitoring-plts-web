/**
 * RealtimeChart.jsx — Grafik garis realtime untuk satu metrik menggunakan Recharts.
 * - METRICS : definisi tiap metrik (key data, label, satuan, warna garis, desimal).
 * - CustomTooltip : tooltip khusus menampilkan waktu (WIB) dan nilai metrik.
 * - Menerima data points (array) dari buffer, memetakan field metrik menjadi
 *   { measured_at, value }, lalu merender LineChart dengan sumbu waktu (jam:menit:detik).
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // Pustaka grafik
import { formatShortDateTime } from '../utils';

// Definisi tiap metrik: key data, label, satuan, warna garis, jumlah desimal
const METRICS = {
  voltage: { key: 'voltage', label: 'Tegangan', unit: 'V', color: '#2563eb', decimals: 1 },
  current: { key: 'current', label: 'Arus', unit: 'A', color: '#f59e0b', decimals: 2 },
  power: { key: 'power', label: 'Daya', unit: 'W', color: '#10b981', decimals: 0 },
  energy: { key: 'energy', label: 'Energi', unit: 'kWh', color: '#8b5cf6', decimals: 2 },
  frequency: { key: 'frequency', label: 'Frekuensi', unit: 'Hz', color: '#06b6d4', decimals: 1 },
  powerFactor: { key: 'power_factor', label: 'PF', unit: '', color: '#ec4899', decimals: 2 }
};

// Tooltip khusus: kotak gelap berisi waktu (WIB) dan nilai metrik
function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload) return null; // Tidak aktif / tidak ada data
  const m = METRICS[metric];
  const val = payload[0]?.value; // Nilai titik yang di-hover
  return (
    <div style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#fff' }}>
      <div>{formatShortDateTime(label)}</div> {/* Waktu titik */}
      <div style={{ fontWeight: 700, marginTop: 2 }}>
        {val !== undefined ? Number(val).toFixed(m.decimals) + (m.unit ? ' ' + m.unit : '') : '---'}
      </div>
    </div>
  );
}

export default function RealtimeChart({ metric, data }) {
  const m = METRICS[metric] || METRICS.voltage; // Konfigurasi metrik (fallback tegangan)
  // Ubah data buffer menjadi [{ measured_at, value }] untuk Recharts
  const chartData = data.map(d => ({
    measured_at: d.measured_at,
    value: d[m.key] ?? null
  }));

  return (
      <div className="chart-canvas-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /> {/* Garis grid */}
          <XAxis
            dataKey="measured_at"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(ts) => { // Label sumbu X: jam:menit:detik WIB
              if (!ts) return '';
              return new Date(ts).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            }}
            interval="preserveStart"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={46}
            domain={['dataMin - auto', 'dataMax + auto']} // Rentang sumbu Y mengikuti data
          />
          <Tooltip content={<CustomTooltip metric={metric} />} /> {/* Tooltip kustom */}
          <Line
            type="monotone"
            dataKey="value"
            stroke={m.color} // Warna garis sesuai metrik
            strokeWidth={2}
            dot={false}
            isAnimationActive={false} // Matikan animasi agar realtime terasa langsung
            activeDot={{ r: 4, fill: m.color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
