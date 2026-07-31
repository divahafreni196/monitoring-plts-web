import { fmt } from '../utils';

const ICONS = {
  voltage: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>,
  current: <><circle cx="12" cy="12" r="10"/><text x="12" y="16" textAnchor="middle" fontSize="14" fontWeight="bold" fill="currentColor">A</text></>,
  power: <><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></>,
  energy: <><rect x="2" y="7" width="20" height="12" rx="2" ry="2"/><path d="M8 3v4M16 3v4"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="12" y1="11" x2="12" y2="19"/></>,
  frequency: <><path d="M4 20L8 4M12 20L16 4M20 20L16 4M8 20L4 4"/></>,
  pf: <><path d="M3 12h4l3-9 4 18 3-9h4"/></>
};

const COLORS = {
  voltage: { bg: '#fee2e2', color: '#dc2626' },
  current: { bg: '#fef3c7', color: '#d97706' },
  power: { bg: '#dbeafe', color: '#1d4ed8' },
  energy: { bg: '#d1fae5', color: '#059669' },
  frequency: { bg: '#cffafe', color: '#06b6d4' },
  pf: { bg: '#f3e8ff', color: '#7c3aed' }
};

export default function MetricCard({ metric, label, value, unit, decimals = 1 }) {
  const c = COLORS[metric] || COLORS.voltage;
  const display = metric === 'energy' && value != null ? Number(value).toFixed(3) : fmt(value, decimals);
  return (
    <div className="metric-card">
      <div className="card-header">
        <div className="card-icon" style={{ background: c.bg, color: c.color }}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {ICONS[metric] || ICONS.voltage}
          </svg>
        </div>
        <span className="card-label">{label}</span>
      </div>
      <div className="card-value">
        <span className="value-number">{display}</span>
        {unit && <span className="value-unit">{unit}</span>}
      </div>
    </div>
  );
}
