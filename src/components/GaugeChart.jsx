/**
 * GaugeChart.jsx — Komponen gauge (speedometer) semi-lingkaran berbasis canvas murni.
 * - CONFIG : definisi default per metrik (rentang, satuan, desimal, zona warna).
 *   Catatan: key "voltage" TIDAK ada di CONFIG karena min/max & zona tegangan
 *   selalu dibangun dinamis dari database (prop voltageLimits — esp32/konfigurasi):
 *   kuning di bawah min, hijau normal, merah di atas max, skala ±100 V dari batas.
 * - getZoneColor() : menentukan warna zona tempat nilai needle berada.
 * - draw() : menggambar latar zona, arc aktif (warna mengikuti zona yang ditunjuk
 *   pointer), jarum, pivot, dan teks nilai.
 * - Resize otomatis menggunakan ResizeObserver + dukungan devicePixelRatio.
 */
import { useRef, useEffect, useMemo } from 'react';

// Konfigurasi default per metrik (selain tegangan): rentang skala, satuan, jumlah
// desimal, dan zona warna. Zona berupa array [mulai(fraksi), akhir(fraksi), warna] dari 0 sampai 1.
// Hanya berisi metrik yang benar-benar dirender sebagai gauge (tegangan & arus).
const CONFIG = {
  // Arus: skala 0-120 A, hijau normal 0-100 A, merah bila > 100 A (0.8333 = 100/120)
  current: { min: 0, max: 120, unit: 'A', decimals: 2, zones: [[0, 0.8333, '#10b981'], [0.8333, 1, '#ef4444']] }
};

// Meta tegangan: hanya berisi satuan & jumlah desimal (bukan nilai batas!).
// Min/max & zona tegangan SELALU berasal dari database (voltageLimits).
const VOLTAGE_BASE = { unit: 'V', decimals: 1 };

// Menentukan warna zona berdasarkan posisi ternormalisasi (0-1) yang ditunjuk pointer.
// Batas akhir zona bersifat eksklusif (norm < e) agar nilai tepat di batas masuk zona berikutnya.
function getZoneColor(zones, norm) {
  for (let i = 0; i < zones.length; i++) {
    const [s, e, c] = zones[i];
    const last = i === zones.length - 1; // Zona terakhir mencakup nilai 1
    if (norm >= s && (norm < e || last)) return c;
  }
  return '#2563eb'; // Fallback biru bila tidak ada zona yang cocok
}

// Fungsi penggambaran utama ke canvas.
function draw(ctx, w, h, cfg, value) {
  ctx.clearRect(0, 0, w, h); // Bersihkan canvas
  const cx = w / 2, cy = h - 40; // Pusat busur (semi-lingkaran)
  const radius = Math.min(w * 0.42, (h - 40) * 0.88); // Jari-jari busur menyesuaikan ukuran
  const aw = Math.max(6, Math.min(12, radius * 0.12)); // Ketebalan garis busur
  const sa = Math.PI, ea = 2 * Math.PI; // Sudut mulai (180°) & akhir (360°) = setengah lingkaran

  // Latar busur abu-abu
  ctx.beginPath(); ctx.arc(cx, cy, radius, sa, ea, false);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = aw; ctx.stroke();

  // Gambar zona warna dengan celah kecil (gap) agar terlihat terpisah & transparan (alpha 0.3)
  for (const [s, e, c] of cfg.zones) {
    const gap = 0.005;
    const zs = sa + (ea - sa) * (s + gap);
    const ze = sa + (ea - sa) * (e - gap);
    ctx.beginPath(); ctx.arc(cx, cy, radius, zs, ze, false);
    ctx.strokeStyle = c; ctx.lineWidth = aw; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1;
  }

  // Nilai tidak tersedia: tampilkan teks "---"
  if (value === null || value === undefined || isNaN(value)) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('---', cx, cy + 20);
    return;
  }

  // Normalisasi nilai ke 0-1 sesuai rentang cfg.min..cfg.max (dijepit di luar rentang)
  const norm = Math.max(0, Math.min(1, (value - cfg.min) / (cfg.max - cfg.min)));
  const angle = sa + (ea - sa) * norm; // Sudut jarum sesuai nilai
  const vc = getZoneColor(cfg.zones, norm); // Warna bar aktif = warna zona yang ditunjuk pointer

  // Bar aktif (arc menyala) dari awal hingga posisi nilai, berwarna vc
  ctx.beginPath(); ctx.arc(cx, cy, radius, sa, angle, false);
  ctx.strokeStyle = vc; ctx.lineWidth = aw; ctx.lineCap = 'round'; ctx.stroke();

  // Jarum (needle) dari pusat menuju sudut nilai
  const nl = radius * 0.82;
  ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * 8, cy + Math.sin(angle) * 8);
  ctx.lineTo(cx + Math.cos(angle) * nl, cy + Math.sin(angle) * nl);
  ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke();

  // Pivot jarum: lingkaran luar gelap + lingkaran dalam putih
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b'; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#fff'; ctx.fill();

  // Teks nilai di bawah pusat
  ctx.fillStyle = '#1e293b'; ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(value.toFixed(cfg.decimals), cx, cy + 20);

  // Satuan di bawah nilai
  if (cfg.unit) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '10px sans-serif';
    ctx.fillText(cfg.unit, cx, cy + 34);
  }
}

export default function GaugeChart({ metric, value, voltageLimits }) {
  const canvasRef = useRef(null); // Referensi elemen <canvas>

  // Bangun konfigurasi efektif per metrik.
  // Khusus "voltage": min/max & zona SELALU dihitung dari database (prop voltageLimits,
  // bersumber esp32/konfigurasi). Fallback 200/240 V hanya bila prop tidak diberikan.
  const cfg = useMemo(() => {
    if (metric === 'voltage') {
      const vmin = Number(voltageLimits?.min) || 200; // Batas minimum dari database (fallback = default DB)
      const vmax = Number(voltageLimits?.max) || 240; // Batas maksimum dari database (fallback = default DB)
      const vLo = Math.min(vmin, vmax); // Amankan jika min > max
      const vHi = Math.max(vmin, vmax);
      const scaleStart = vLo - 100; // Skala visual melebar 100 V di bawah batas min
      const scaleEnd = vHi + 100;   // Skala visual melebar 100 V di atas batas max
      const scaleWidth = scaleEnd - scaleStart;
      const nMin = (vLo - scaleStart) / scaleWidth; // Posisi fraksi batas min pada skala
      const nMax = (vHi - scaleStart) / scaleWidth; // Posisi fraksi batas max pada skala
      return {
        ...VOLTAGE_BASE,
        min: scaleStart,
        max: scaleEnd,
        // Kuning di bawah min, hijau rentang normal, merah di atas max
        zones: [
          [0, nMin, '#f59e0b'],
          [nMin, nMax, '#10b981'],
          [nMax, 1, '#ef4444']
        ]
      };
    }
    return CONFIG[metric] || CONFIG.current; // Metrik lain: pakai konfigurasi statis; fallback arus
  }, [metric, voltageLimits]);

  // Redraw otomatis saat ukuran wadah berubah (ResizeObserver), termasuk saat dpr berubah
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement; // Wadah gauge-card
    const ro = new ResizeObserver(() => {
      const w = container.offsetWidth || 150; // Lebar wadah (fallback 150)
      const h = Math.max(120, Math.min(170, w * 0.5)); // Tinggi antara 120-170
      const dpr = window.devicePixelRatio || 1; // Rasio piksel perangkat (layar retina)
      canvas.style.width = w + 'px';  // Ukuran tampilan (CSS)
      canvas.style.height = h + 'px';
      canvas.width = w * dpr; // Ukuran buffer piksel (lebih tajam)
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr); // Skala koordinat agar gambar proporsional
      draw(ctx, w, h, cfg, value); // Gambar ulang
    });
    ro.observe(container);
    return () => ro.disconnect(); // Bersihkan observer saat komponen unmount
  }, [value, cfg]);

  // Redraw tambahan setiap value/cfg berubah (mis. data realtime baru)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset transformasi sebelum menggambar
    const w = parseFloat(canvas.style.width) || 150;
    const h = parseFloat(canvas.style.height) || 90;
    draw(ctx, w, h, cfg, value);
  }, [value, cfg]);

  return <canvas ref={canvasRef} />; // Elemen canvas tempat gauge digambar
}
