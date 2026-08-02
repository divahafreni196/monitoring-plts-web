/**
 * Sidebar.jsx — Panel navigasi samping aplikasi.
 * - NAV : daftar menu (Dashboard, Riwayat, Data Abnormal, Telegram) dengan ikon SVG.
 * - Menampilkan logo PLTS Monitor, status ESP32 mini, tombol Login Admin / Logout.
 * - Responsif untuk mobile: muncul dengan overlay saat state `open` aktif.
 */
import { getEspStatus } from '../utils';

// Daftar menu navigasi: id, label, dan ikon SVG
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></> },
  { id: 'history', label: 'Riwayat', icon: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></> },
  { id: 'abnormal', label: 'Data Abnormal', icon: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></> },
  { id: 'telegram', label: 'Telegram', icon: <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></> }
];

export default function Sidebar({ section, setSection, realtimeData, open, onClose, isAdmin, onLoginClick, onLogout }) {
  const status = getEspStatus(realtimeData?.received_at); // Status ESP32 (online/offline)

  return (
    <>
      {/* Overlay gelap di belakang sidebar (mode mobile) */}
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        {/* Header: logo + tombol tutup */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg className="logo-icon" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <span className="logo-text">PLTS Monitor</span>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Tutup menu">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Menu navigasi: klik untuk berpindah halaman */}
        <nav className="sidebar-nav">
          {NAV.map(item => (
            <a key={item.id} href="#"
              className={`nav-item ${section === item.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setSection(item.id); onClose(); }} // Ganti halaman + tutup sidebar
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
        {/* Footer: status ESP32 mini + tombol login/logout admin */}
        <div className="sidebar-footer">
          <div className="esp-status-mini" style={{ marginBottom: 8 }}>
            <span className={`status-dot status-${status}`}></span>
            <span>{status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Memuat...'}</span>
          </div>
          {isAdmin ? (
            /* Admin login: tampilkan tombol logout */
            <button className="nav-item" onClick={onLogout} style={{ width: '100%', fontSize: '0.8rem' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Admin — Logout</span>
            </button>
          ) : (
            /* Belum login: tampilkan tombol login admin */
            <button className="nav-item" onClick={onLoginClick} style={{ width: '100%', fontSize: '0.8rem' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              <span>Login Admin</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
