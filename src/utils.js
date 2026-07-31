export function formatDateTime(timestamp) {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) return '---';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date(timestamp)) + ' WIB';
  } catch { return '---'; }
}

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

export function fmt(v, d = 1) {
  return (v === null || v === undefined || isNaN(v)) ? '---' : Number(v).toFixed(d);
}

export function getEspStatus(receivedAt) {
  if (!receivedAt || isNaN(receivedAt)) return 'unknown';
  return (Date.now() - receivedAt) / 60000 <= 2 ? 'online' : 'offline';
}

export function getVoltageStatus(voltage, batas_minimum = 200, batas_maximum = 240) {
  if (voltage === null || voltage === undefined || isNaN(voltage))
    return { label: 'Tidak Diketahui', type: 'unknown' };
  if (voltage < batas_minimum) return { label: 'UNDER VOLTAGE', type: 'low' };
  if (voltage > batas_maximum) return { label: 'OVER VOLTAGE', type: 'high' };
  return { label: 'Normal', type: 'normal' };
}
