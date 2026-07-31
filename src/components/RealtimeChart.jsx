import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatShortDateTime } from '../utils';

const METRICS = {
  voltage: { key: 'voltage', label: 'Tegangan', unit: 'V', color: '#2563eb', decimals: 1 },
  current: { key: 'current', label: 'Arus', unit: 'A', color: '#f59e0b', decimals: 2 },
  power: { key: 'power', label: 'Daya', unit: 'W', color: '#10b981', decimals: 0 },
  energy: { key: 'energy', label: 'Energi', unit: 'kWh', color: '#8b5cf6', decimals: 2 },
  frequency: { key: 'frequency', label: 'Frekuensi', unit: 'Hz', color: '#06b6d4', decimals: 1 },
  powerFactor: { key: 'power_factor', label: 'PF', unit: '', color: '#ec4899', decimals: 2 }
};

function CustomTooltip({ active, payload, label, metric }) {
  if (!active || !payload) return null;
  const m = METRICS[metric];
  const val = payload[0]?.value;
  return (
    <div style={{ background: '#1e293b', padding: '8px 12px', borderRadius: 6, fontSize: 12, color: '#fff' }}>
      <div>{formatShortDateTime(label)}</div>
      <div style={{ fontWeight: 700, marginTop: 2 }}>
        {val !== undefined ? Number(val).toFixed(m.decimals) + (m.unit ? ' ' + m.unit : '') : '---'}
      </div>
    </div>
  );
}

export default function RealtimeChart({ metric, data }) {
  const m = METRICS[metric] || METRICS.voltage;
  const chartData = data.map(d => ({
    measured_at: d.measured_at,
    value: d[m.key] ?? null
  }));

  return (
      <div className="chart-canvas-wrapper">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="measured_at"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(ts) => {
              if (!ts) return '';
              return new Date(ts).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            }}
            interval="preserveStart"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            width={36}
            domain={['dataMin - auto', 'dataMax + auto']}
          />
          <Tooltip content={<CustomTooltip metric={metric} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke={m.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: m.color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
