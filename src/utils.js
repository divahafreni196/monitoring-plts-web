/**
 * utils.js — Fungsi utilitas umum yang dipakai di berbagai komponen.
 * - formatDateTime()    : format timestamp menjadi tanggal-waktu lengkap WIB (id-ID).
 * - formatShortDateTime(): format timestamp menjadi YYYY-MM-DD HH:mm:ss (zona WIB).
 * - fmt()               : format angka ke desimal tertentu, "---" jika tidak valid.
 * - getEspStatus()      : status online/offline ESP32 (online jika <= 2 menit).
 * - getVoltageStatus()  : klasifikasi kondisi tegangan (UNDER VOLTAGE / OVER VOLTAGE /
 *                         Normal / Tidak Diketahui) berdasarkan batas min & max.
 */
// Format timestamp menjadi "tanggal bulan tahun, jam:menit:detik WIB" (Bahasa Indonesia)
export function formatDateTime(timestamp) {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return '---'; // Timestamp tidak valid
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta', // Zona waktu WIB
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date(timestamp)) + ' WIB';
  } catch { return '---'; } // Tanggal tidak bisa diparse
}

// Format timestamp menjadi "YYYY-MM-DD HH:mm:ss" (zona WIB), tanpa nama bulan
export function formatShortDateTime(timestamp) {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return '---';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date(timestamp));
  } catch { return '---'; }
}

// Format angka ke n desimal; "---" bila nilai null/NaN
export function fmt(v, d = 1) {
  return (v === null || v === undefined || isNaN(v)) ? '---' : Number(v).toFixed(d);
}

// Status ESP32: 'online' bila pembaruan terakhir <= 2 menit yang lalu
export function getEspStatus(receivedAt) {
  if (!receivedAt || isNaN(receivedAt)) return 'unknown'; // Belum ada data
  return (Date.now() - receivedAt) / 60000 <= 2 ? 'online' : 'offline';
}

// Klasifikasi kondisi tegangan berdasarkan batas min & max.
// Batas dikirim pemanggil (dari database esp32/konfigurasi via Dashboard);
// parameter default 200-240 V hanya dipakai bila pemanggil tidak mengirim nilai.
export function getVoltageStatus(voltage, batas_minimum = 200, batas_maximum = 240) {
  if (voltage === null || voltage === undefined || isNaN(voltage))
    return { label: 'Tidak Diketahui', type: 'unknown' };
  if (voltage < batas_minimum) return { label: 'UNDER VOLTAGE', type: 'low' }; // Di bawah batas
  if (voltage > batas_maximum) return { label: 'OVER VOLTAGE', type: 'high' }; // Di atas batas
  return { label: 'Normal', type: 'normal' }; // Dalam rentang normal
}
