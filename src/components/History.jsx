/**
 * History.jsx — Halaman Riwayat Data.
 * - Tab "Riwayat Detail": tabel data lengkap dengan filter rentang tanggal, paginasi
 *   (20 baris/halaman), mode pilih (admin) untuk hapus data terpilih, dan tombol
 *   "Hapus Semua" (admin) untuk menghapus seluruh node esp32/riwayat.
 * - Tab "Rekap Harian": ringkasan per tanggal (tegangan tertinggi/terendah,
 *   arus & daya tertinggi).
 * - Export ke file Excel (.xlsx) berisi sheet "Riwayat Detail" dan "Rekap Harian".
 * - Menampilkan ukuran data riwayat terhadap batas 1 GB.
 */
import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx'; // Pustaka untuk export Excel
import { formatShortDateTime, fmt } from '../utils';
import { deleteData } from '../firebase';
import { useHistoryData } from '../hooks';

// Ambil tanggal dalam format YYYY-MM-DD (zona WIB) dari timestamp
function getDateWIB(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

const PER_PAGE = 20; // Jumlah baris per halaman

export default function History({ isAdmin, onDataChanged }) {
  const { data, loading, error, refresh } = useHistoryData(); // Data riwayat + pemuat
  const [page, setPage] = useState(1); // Halaman saat ini
  const [tab, setTab] = useState('detail'); // Tab aktif: detail / rekap
  const [startDate, setStartDate] = useState(''); // Filter tanggal awal
  const [endDate, setEndDate] = useState(''); // Filter tanggal akhir
  const [selectMode, setSelectMode] = useState(false); // Mode pilih aktif?
  const [selected, setSelected] = useState(new Set()); // Key data yang dicentang
  const [deleting, setDeleting] = useState(false); // Sedang menghapus (batch)?
  const [deletingAll, setDeletingAll] = useState(false); // Sedang menghapus semua?

  // Set filter default: awal bulan (tanggal 1) sampai hari ini
  useEffect(() => {
    const now = new Date();
    const fmt = (d) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const start = new Date(now.getFullYear(), now.getMonth(), 0); // Hari pertama bulan ini
    setStartDate(fmt(start));
    setEndDate(fmt(now));
  }, []);

  // Filter data detail berdasarkan rentang tanggal (zona WIB)
  const filteredForDetail = useMemo(() => {
    let arr = [...data];
    if (startDate) {
      const s = new Date(startDate + 'T00:00:00+07:00').getTime(); // Awal hari
      arr = arr.filter(d => (d.measured_at || 0) >= s);
    }
    if (endDate) {
      const e = new Date(endDate + 'T23:59:59.999+07:00').getTime(); // Akhir hari
      arr = arr.filter(d => (d.measured_at || 0) <= e);
    }
    return arr;
  }, [data, startDate, endDate]);

  // Rekap harian: agregasi per tanggal (vMax, vMin, aMax, pMax)
  const dailySummary = useMemo(() => {
    const map = {};
    for (const d of data) {
      if (!d.measured_at || d.measured_at < 1000000000000) continue; // Abaikan timestamp tidak valid
      const date = getDateWIB(d.measured_at);
      if (!date) continue;
      if (!map[date]) map[date] = { date, vMax: -Infinity, vMin: Infinity, aMax: -Infinity, pMax: -Infinity };
      const day = map[date];
      // Hitung tegangan tertinggi & terendah
      if (d.voltage != null) {
        if (d.voltage > day.vMax) day.vMax = d.voltage;
        if (d.voltage < day.vMin) day.vMin = d.voltage;
      }
      if (d.current != null && d.current > day.aMax) day.aMax = d.current; // Arus tertinggi
      if (d.power != null && d.power > day.pMax) day.pMax = d.power;       // Daya tertinggi
    }
    return Object.values(map).sort((a, b) => b.date.localeCompare(a.date)); // Urut tanggal terbaru
  }, [data]);

  // Toggle centang satu data
  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Hapus data riwayat terpilih (batch)
  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Hapus ${selected.size} data riwayat terpilih?`)) return; // Konfirmasi dulu
    setDeleting(true);
    try {
      for (const key of selected) {
        await deleteData(`esp32/riwayat/${key}`); // Hapus satu per satu berdasarkan key
      }
      setSelected(new Set());
      setSelectMode(false);
      if (onDataChanged) onDataChanged(); // Beri tahu App (isi ulang buffer grafik)
      refresh(); // Muat ulang daftar
    } catch (e) {
      alert('Gagal menghapus data: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  // Hapus SELURUH data riwayat (node esp32/riwayat)
  const handleDeleteAll = async () => {
    if (!window.confirm('Hapus SEMUA data riwayat? Tindakan ini tidak dapat dibatalkan.')) return;
    setDeletingAll(true);
    try {
      await deleteData('esp32/riwayat'); // Hapus seluruh node
      setSelected(new Set());
      setSelectMode(false);
      if (onDataChanged) onDataChanged();
      refresh();
    } catch (e) {
      alert('Gagal menghapus data: ' + e.message);
    } finally {
      setDeletingAll(false);
    }
  };

  // Keluar dari mode pilih
  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Export seluruh data riwayat + rekap harian ke file Excel
  const handleExport = () => {
    const detailRows = data.map(d => ({ // Baris sheet detail
      Waktu: formatShortDateTime(d.measured_at),
      'Tegangan (V)': d.voltage != null ? Number(d.voltage) : '',
      'Arus (A)': d.current != null ? Number(d.current) : '',
      'Daya (W)': d.power != null ? Number(d.power) : '',
      'Energi (kWh)': d.energy != null ? Number(d.energy) : '',
      'Frekuensi (Hz)': d.frequency != null ? Number(d.frequency) : '',
      PF: d.power_factor != null ? Number(d.power_factor) : ''
    }));
    const rekapRows = dailySummary.map(s => ({ // Baris sheet rekap
      Tanggal: s.date,
      'Tegangan Tertinggi (V)': s.vMax > -Infinity ? Number(s.vMax).toFixed(1) : '',
      'Tegangan Terendah (V)': s.vMin < Infinity ? Number(s.vMin).toFixed(1) : '',
      'Arus Tertinggi (A)': s.aMax > -Infinity ? Number(s.aMax).toFixed(2) : '',
      'Daya Tertinggi (W)': s.pMax > -Infinity ? Number(s.pMax).toFixed(0) : ''
    }));
    const wb = XLSX.utils.book_new(); // Buat workbook baru
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), 'Riwayat Detail'); // Sheet 1
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rekapRows), 'Rekap Harian'); // Sheet 2
    XLSX.writeFile(wb, `riwayat-plts-${getDateWIB(Date.now())}.xlsx`); // Simpan file
  };

  // Ukuran data riwayat (estimasi byte) terhadap batas 1 GB
  const dataSize = useMemo(() => {
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    const pct = Math.min(100, (bytes / 1073741824) * 100); // Persentase terhadap 1 GB
    let label;
    if (bytes >= 1073741824) label = (bytes / 1073741824).toFixed(2) + ' GB';
    else if (bytes >= 1048576) label = (bytes / 1048576).toFixed(2) + ' MB';
    else if (bytes >= 1024) label = (bytes / 1024).toFixed(1) + ' KB';
    else label = bytes + ' B';
    return { text: `(${label} / 1 GB)`, pct };
  }, [data]);

  // Paginasi: hitung total halaman & potong data per halaman
  const totalPages = Math.max(1, Math.ceil(filteredForDetail.length / PER_PAGE));
  const pg = Math.min(page, totalPages); // Pastikan halaman tidak melebihi total
  const start = (pg - 1) * PER_PAGE;
  const pageData = filteredForDetail.slice(start, start + PER_PAGE);

  return (
    <section className="content-section active">
      {/* Header: judul, badge ukuran data, filter tanggal, tombol export & refresh */}
      <div className="section-header">
        <h2 className="section-subtitle">Riwayat Data</h2>
        {/* Badge ukuran data (berubah warna sesuai kapasitas) */}
        {tab === 'detail' && !loading && <span className="data-size-badge" style={{ background: dataSize.pct > 80 ? 'var(--danger-light)' : dataSize.pct > 50 ? 'var(--warning-light)' : 'var(--primary-light)', color: dataSize.pct > 80 ? 'var(--danger-dark)' : dataSize.pct > 50 ? 'var(--warning-dark)' : 'var(--primary)' }}>{dataSize.text}</span>}
        <div className="filter-controls">
          {/* Filter rentang tanggal (hanya di tab detail) */}
          {tab === 'detail' && (
            <>
              <div className="filter-group"><label>Dari:</label><input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }} /></div>
              <div className="filter-group"><label>Sampai:</label><input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }} /></div>
            </>
          )}
          {/* Tombol export Excel */}
          {!loading && (
            <button className="btn btn-success" onClick={handleExport}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export
            </button>
          )}
          {/* Tombol refresh data */}
          <button className="btn btn-primary" onClick={refresh}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Tab: Riwayat Detail / Rekap Harian */}
      <div className="sub-tabs" style={{ marginBottom: 16 }}>
        <button className={`sub-tab ${tab === 'detail' ? 'active' : ''}`} onClick={() => setTab('detail')}>Riwayat Detail</button>
        <button className={`sub-tab ${tab === 'rekap' ? 'active' : ''}`} onClick={() => setTab('rekap')}>Rekap Harian</button>
      </div>

      {/* Indikator loading & error */}
      {loading && <div className="loading-indicator"><div className="spinner" /><span>Memuat data riwayat...</span></div>}
      {error && <div className="error-message"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>{error}</span></div>}

      {/* ===== Tab Rekap Harian ===== */}
      {!loading && !error && tab === 'rekap' && (
        <div className="table-container">
          {dailySummary.length === 0 ? (
            <div className="empty-state"> {/* Belum ada data */}
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
              <p>Belum ada data rekap harian.</p>
            </div>
          ) : (
            <table className="data-table mobile-cards">
              <thead><tr><th>Tanggal</th><th>Tegangan Tertinggi</th><th>Tegangan Terendah</th><th>Arus Tertinggi</th><th>Daya Tertinggi</th></tr></thead>
              <tbody>
                {dailySummary.map((s, i) => (
                  <tr key={i}>
                    <td>{s.date}</td>
                    <td data-label="Tegangan Tertinggi">{s.vMax > -Infinity ? Number(s.vMax).toFixed(1) + ' V' : '---'}</td>
                    <td data-label="Tegangan Terendah">{s.vMin < Infinity ? Number(s.vMin).toFixed(1) + ' V' : '---'}</td>
                    <td data-label="Arus Tertinggi">{s.aMax > -Infinity ? Number(s.aMax).toFixed(2) + ' A' : '---'}</td>
                    <td data-label="Daya Tertinggi">{s.pMax > -Infinity ? Number(s.pMax).toFixed(0) + ' W' : '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ===== Tab Riwayat Detail ===== */}
      {!loading && !error && tab === 'detail' && (
        <>
          {/* Bar hapus data (khusus admin) */}
          {isAdmin && pageData.length > 0 && (
            <div className="delete-bar">
              {selectMode ? (
                /* Mode pilih aktif: tampilkan info & aksi hapus terpilih */
                <>
                  <span className="delete-info">{selected.size} data terpilih</span>
                  <div className="delete-actions">
                    <button className="btn btn-small" onClick={cancelSelect}>Batal</button>
                    <button className="btn btn-danger btn-small" disabled={selected.size === 0 || deleting} onClick={handleBatchDelete}>
                      {deleting ? 'Menghapus...' : `Hapus Terpilih (${selected.size})`}
                    </button>
                  </div>
                </>
              ) : (
                /* Mode normal: tombol masuk mode pilih + tombol hapus semua */
                <div className="delete-actions">
                  <button className="btn btn-danger btn-small" onClick={() => setSelectMode(true)}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    Hapus
                  </button>
                  <button className="btn btn-danger btn-small" disabled={deletingAll} onClick={handleDeleteAll}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    {deletingAll ? 'Menghapus...' : 'Hapus Semua'}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="table-container">
            {pageData.length === 0 ? (
              <div className="empty-state"> {/* Tidak ada data pada rentang/halaman */}
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                <p>Belum ada data riwayat tersedia.</p>
              </div>
            ) : (
              <table className="data-table mobile-cards">
                <thead><tr>{selectMode && <th style={{ width: 36 }}></th>}<th>Waktu</th><th>Tegangan</th><th>Arus</th><th>Daya</th><th>Energi</th><th>Frekuensi</th><th>PF</th></tr></thead>
                <tbody>
                  {pageData.map((d) => (
                    <tr key={d._key || Math.random()} className={selected.has(d._key) ? 'row-selected' : ''}>
                      {selectMode && (
                        <td className="td-checkbox">
                          <input type="checkbox" className="row-checkbox" checked={selected.has(d._key)} onChange={() => toggleSelect(d._key)} />
                        </td>
                      )}
                      <td>{formatShortDateTime(d.measured_at)}</td>
                      <td data-label="Tegangan">{fmt(d.voltage)} V</td>
                      <td data-label="Arus">{fmt(d.current, 2)} A</td>
                      <td data-label="Daya">{fmt(d.power, 0)} W</td>
                      <td data-label="Energi">{d.energy != null ? Number(d.energy).toFixed(3) : '---'} kWh</td>
                      <td data-label="Frekuensi">{fmt(d.frequency)} Hz</td>
                      <td data-label="PF">{fmt(d.power_factor, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Paginasi (hanya tab detail dengan lebih dari 1 halaman) */}
      {!loading && tab === 'detail' && totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-small" disabled={pg <= 1} onClick={() => setPage(pg - 1)}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Sebelumnya
          </button>
          <span className="page-info">Halaman {pg} dari {totalPages}</span>
          <button className="btn btn-small" disabled={pg >= totalPages} onClick={() => setPage(pg + 1)}>
            Selanjutnya
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      )}
    </section>
  );
}
