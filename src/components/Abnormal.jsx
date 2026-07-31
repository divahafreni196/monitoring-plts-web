import { useState, useMemo } from 'react';
import { formatShortDateTime, fmt } from '../utils';
import { deleteData } from '../firebase';
import { useAbnormalData } from '../hooks';

const PER_PAGE = 20;

export default function Abnormal({ isAdmin }) {
  const { data, loading, error, refresh } = useAbnormalData();
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  const sorted = useMemo(() => [...data].sort((a, b) => (b.measured_at || 0) - (a.measured_at || 0)), [data]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const pg = Math.min(page, totalPages);
  const start = (pg - 1) * PER_PAGE;
  const pageData = sorted.slice(start, start + PER_PAGE);

  const getStatus = (d) => {
    const s = d?.status ? String(d.status).toUpperCase() : '';
    if (s === 'UNDER VOLTAGE') return { label: 'UNDER VOLTAGE', cls: 'status-under' };
    if (s === 'OVER VOLTAGE') return { label: 'OVER VOLTAGE', cls: 'status-over' };
    if (s === 'NORMAL') return { label: 'NORMAL', cls: 'status-normal' };
    return { label: '---', cls: '' };
  };

  const toggleSelect = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const cancelSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Hapus ${selected.size} data abnormal terpilih?`)) return;
    setDeleting(true);
    try {
      for (const key of selected) {
        await deleteData(`esp32/abnormal/${key}`);
      }
      setSelected(new Set());
      setSelectMode(false);
      refresh();
    } catch (e) {
      alert('Gagal menghapus data: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="content-section active">
      <div className="section-header">
        <h2 className="section-subtitle">Data Abnormal</h2>
        <button className="btn btn-primary" onClick={refresh}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          Refresh
        </button>
      </div>

      {loading && <div className="loading-indicator"><div className="spinner" /><span>Memuat data abnormal...</span></div>}
      {error && <div className="error-message"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><span>{error}</span></div>}

      {!loading && !error && (
        <>
          {isAdmin && pageData.length > 0 && (
            <div className="delete-bar">
              {selectMode ? (
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
                <button className="btn btn-danger btn-small" onClick={() => setSelectMode(true)}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  Hapus
                </button>
              )}
            </div>
          )}
        <div className="table-container">
          {pageData.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p>Belum ada kejadian abnormal.</p>
            </div>
          ) : (
            <table className="data-table mobile-cards">
              <thead><tr>{selectMode && <th style={{ width: 36 }}></th>}<th>Waktu</th><th>Tegangan</th><th>Status</th></tr></thead>
              <tbody>
                {pageData.map((d, i) => {
                  const st = getStatus(d);
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