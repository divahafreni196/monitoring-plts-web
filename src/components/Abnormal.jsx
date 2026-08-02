/**
 * Abnormal.jsx — Halaman Data Abnormal.
 * Menampilkan tabel kejadian abnormal (waktu, tegangan, status) dari esp32/abnormal
 * dengan paginasi (20 baris/halaman). Khusus admin: mode pilih untuk menghapus
 * data terpilih (batch delete). Status dikategorikan UNDER VOLTAGE / OVER VOLTAGE /
 * NORMAL dengan tag berwarna.
 */
import { useState, useMemo } from 'react';
import { formatShortDateTime, fmt } from '../utils';
import { deleteData } from '../firebase';
import { useAbnormalData } from '../hooks';

const PER_PAGE = 20; // Jumlah baris per halaman

export default function Abnormal({ isAdmin }) {
  const { data, loading, error, refresh } = useAbnormalData(); // Data abnormal + pemuat
  const [page, setPage] = useState(1); // Halaman saat ini
  const [selectMode, setSelectMode] = useState(false); // Mode pilih aktif?
  const [selected, setSelected] = useState(new Set()); // Key data yang dicentang
  const [deleting, setDeleting] = useState(false); // Sedang menghapus?

  // Data diurutkan terbaru dulu
  const sorted = useMemo(() => [...data].sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0)), [data]);
  // Paginasi: total halaman & potongan data per halaman
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pg = Math.min(page, totalPages);
  const start = (pg - 1) * PER_PAGE;
  const pageData = sorted.slice(start, start + PER_PAGE);

  // Terjemahkan status ke label + kelas CSS tag
  const getStatus = (d) => {
    const s = d?.status ? String(d.status).toUpperCase() : '';
    if (s === 'UNDER VOLTAGE') return { label: 'UNDER VOLTAGE', cls: 'status-under' };
    if (s === 'OVER VOLTAGE') return { label: 'OVER VOLTAGE', cls: 'status-over' };
    if (s === 'NORMAL') return { label: 'NORMAL', cls: 'status-normal' };
    return { label: '---', cls: '' }; // Status tidak dikenal
  };

  // Toggle centang satu data
  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Keluar dari mode pilih
  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  // Hapus data abnormal terpilih (batch)
  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Hapus ${selected.size} data abnormal terpilih?`)) return; // Konfirmasi
    setDeleting(true);
    try {
      for (const key of selected) {
        await deleteData(`esp32/abnormal/${key}`); // Hapus satu per satu
      }
      setSelected(new Set());
      setSelectMode(false);
      refresh(); // Muat ulang daftar
    } catch (e) {
      alert('Gagal menghapus data: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="content-section active">
      {/* Header: judul + tombol refresh */}
      <div className="section-header">
        <h2 className="section-subtitle">Data Abnormal</h2>
        <button className="btn btn-primary" onClick={refresh}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {/* Indikator loading & error */}
      {loading && <div className="loading-indicator"><div className="spinner" /><span>Memuat data abnormal...</span></div>}
      {error && <div className="error-message"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>{error}</span></div>}

      {!loading && !error && (
        <>
          {/* Bar hapus data (khusus admin) */}
          {isAdmin && pageData.length > 0 && (
            <div className="delete-bar">
              {selectMode ? (
                /* Mode pilih: info jumlah + tombol batal & hapus terpilih */
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
                /* Mode normal: tombol masuk mode pilih */
                <button className="btn btn-danger btn-small" onClick={() => setSelectMode(true)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Hapus
                </button>
              )}
            </div>
          )}
        <div className="table-container">
          {pageData.length === 0 ? (
            <div className="empty-state"> {/* Belum ada kejadian abnormal */}
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p>Belum ada kejadian abnormal.</p>
            </div>
          ) : (
            <table className="data-table mobile-cards">
              <thead><tr>{selectMode && <th style={{ width: 36 }}></th>}<th>Waktu</th><th>Tegangan</th><th>Status</th></tr></thead>
              <tbody>
                {pageData.map((d, i) => {
                  const st = getStatus(d); // Label & kelas status baris ini
                  return (
                    <tr key={d._key || i} className={selected.has(d._key) ? 'row-selected' : ''}>
                      {selectMode && (
                        <td className="td-checkbox">
                          <input type="checkbox" className="row-checkbox" checked={selected.has(d._key)} onChange={() => toggleSelect(d._key)} />
                        </td>
                      )}
                      <td>{formatShortDateTime(d.measured_at)}</td>
                      <td className="td-voltage" data-label="Tegangan">{fmt(d.voltage)} V</td>
                      <td data-label="Status"><span className={`status-tag ${st.cls}`}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        </>
      )}

      {/* Paginasi */}
      {!loading && totalPages > 1 && (
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