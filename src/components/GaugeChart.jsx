import { useRef, useEffect, useMemo } from 'react';

const CONFIG = {
  voltage: { min: 180, max: 260, unit: 'V', decimals: 1, zones: [[0,0.125,'#f59e0b'],[0.125,0.875,'#10b981'],[0.875,1,'#f59e0b']] },
  current: { min: 0, max: 100, unit: 'A', decimals: 2, zones: [[0,0.05,'#ef4444'],[0.05,0.15,'#f59e0b'],[0.15,0.8,'#10b981'],[0.8,0.92,'#f59e0b'],[0.92,1,'#ef4444']] },
  power: { min: 0, max: 500, unit: 'W', decimals: 0, zones: [[0,0.02,'#ef4444'],[0.02,0.1,'#f59e0b'],[0.1,0.8,'#10b981'],[0.8,0.95,'#f59e0b'],[0.95,1,'#ef4444']] },
  energy: { min: 0, max: 10, unit: 'kWh', decimals: 2, zones: [[0,0.02,'#ef4444'],[0.02,0.1,'#f59e0b'],[0.1,0.85,'#10b981'],[0.85,0.95,'#f59e0b'],[0.95,1,'#ef4444']] },
  frequency: { min: 48, max: 52, unit: 'Hz', decimals: 1, zones: [[0,0.125,'#ef4444'],[0.125,0.25,'#f59e0b'],[0.25,0.75,'#10b981'],[0.75,0.875,'#f59e0b'],[0.875,1,'#ef4444']] },
  powerFactor: { min: 0, max: 1, unit: '', decimals: 2, zones: [[0,0.2,'#ef4444'],[0.2,0.4,'#f59e0b'],[0.4,0.6,'#f59e0b'],[0.6,0.8,'#f59e0b'],[0.8,1,'#10b981']] }
};

function getZoneColor(zones, norm) {
  for (const [s, e, c] of zones) if (norm >= s && norm <= e) return c;
  return '#2563eb';
}

function draw(ctx, w, h, cfg, value) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h - 40;
  const radius = Math.min(w * 0.42, (h - 40) * 0.88);
  const aw = Math.max(6, Math.min(12, radius * 0.12));
  const sa = Math.PI, ea = 2 * Math.PI;

  ctx.beginPath(); ctx.arc(cx, cy, radius, sa, ea, false);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = aw; ctx.stroke();

  for (const [s, e, c] of cfg.zones) {
    const gap = 0.005;
    const zs = sa + (ea - sa) * (s + gap);
    const ze = sa + (ea - sa) * (e - gap);
    ctx.beginPath(); ctx.arc(cx, cy, radius, zs, ze, false);
    ctx.strokeStyle = c; ctx.lineWidth = aw; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
  }

  if (value === null || value === undefined || isNaN(value)) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('---', cx, cy + 20);
    return;
  }

  const norm = Math.max(0, Math.min(1, (value - cfg.min) / (cfg.max - cfg.min)));
  const angle = sa + (ea - sa) * norm;
  const vc = getZoneColor(cfg.zones, norm);

  ctx.beginPath(); ctx.arc(cx, cy, radius, sa, angle, false);
  ctx.strokeStyle = vc; ctx.lineWidth = aw; ctx.lineCap = 'round'; ctx.stroke();

  const nl = radius * 0.82;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 8, cy + Math.sin(angle) * 8);
  ctx.lineTo(cx + Math.cos(angle) * nl, cy + Math.sin(angle) * nl);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();

  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();

  ctx.fillStyle = '#1e293b'; ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(value.toFixed(cfg.decimals), cx, cy + 20);

  if (cfg.unit) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
    ctx.fillText(cfg.unit, cx, cy + 34);
  }
}

export default function GaugeChart({ metric, value, voltageLimits }) {
  const canvasRef = useRef(null);
  const cfg = useMemo(() => {
    const base = CONFIG[metric] || CONFIG.voltage;
    if (metric !== 'voltage' || !voltageLimits) return base;
    const vmin = Number(voltageLimits.min) || 200;
    const vmax = Number(voltageLimits.max) || 240;
    const norm = (v) => (v - base.min) / (base.max - base.min);
    const nMin = Math.max(0, Math.min(1, norm(vmin)));
    const nMax = Math.max(0, Math.min(1, norm(vmax)));
    return {
      ...base,
      zones: [
        [0, Math.min(nMin, nMax), '#f59e0b'],
        [Math.min(nMin, nMax), Math.max(nMin, nMax), '#10b981'],
        [Math.max(nMin, nMax), 1, '#f59e0b']
      ]
    };
  }, [metric, voltageLimits]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    const ro = new ResizeObserver(() => {
      const w = container.offsetWidth || 150;
      const h = Math.max(120, Math.min(170, w * 0.5));
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      draw(ctx, w, h, cfg, value);
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [value, cfg]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = parseFloat(canvas.style.width) || 150;
    const h = parseFloat(canvas.style.height) || 90;
    draw(ctx, w, h, cfg, value);
  }, [value, cfg]);

  return <canvas ref={canvasRef} />;
}
