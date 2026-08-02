/**
 * App.jsx — Komponen akar (root) aplikasi monitoring PLTS.
 * Bertugas:
 * - Mengatur navigasi antar halaman (Dashboard, Riwayat, Data Abnormal, Telegram).
 * - Menyediakan data realtime dari Firebase (useRealtimeData, useConfigData,
 *   useAbnormalData, useChartBuffer) dan monitor notifikasi Telegram (useTelegramMonitor).
 * - Mengelola status login admin (localStorage) dan header aplikasi (judul halaman,
 *   indikator status online/offline ESP32).
 * - Memunculkan modal login admin saat dibutuhkan.
 */
import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';   // Navigasi samping
import Dashboard from './components/Dashboard'; // Halaman utama
import History from './components/History';   // Halaman riwayat
import Abnormal from './components/Abnormal'; // Halaman data abnormal
import Telegram from './components/Telegram'; // Halaman notifikasi Telegram
import LoginModal from './components/LoginModal'; // Modal login admin
import { useRealtimeData, useAbnormalData, useChartBuffer, useConfigData, useTelegramMonitor } from './hooks';

// Judul halaman sesuai bagian (section) aktif
const SECTION_TITLES = {
  dashboard: 'Dashboard',
  history: 'Riwayat',
  abnormal: 'Data Abnormal',
  telegram: 'Telegram'
};

export default function App() {
  const [section, setSection] = useState('dashboard'); // Halaman aktif saat ini
  const [sidebarOpen, setSidebarOpen] = useState(false); // Sidebar terbuka (mode mobile)
  const [showLogin, setShowLogin] = useState(false); // Modal login tampil
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('admin_logged_in') === 'true'); // Status admin dari localStorage
  const { data: realtimeData } = useRealtimeData(); // Data realtime ESP32 (esp32/realtime)
  const { data: abnormalData } = useAbnormalData(); // Data kejadian abnormal
  const { points: chartPoints, addPoint, backfill } = useChartBuffer(); // Buffer titik grafik realtime
  const config = useConfigData(); // Konfigurasi batas tegangan (esp32/konfigurasi)
  const telegramMonitor = useTelegramMonitor({ config }); // Monitor notifikasi Telegram

  // Isi ulang buffer grafik dengan riwayat terakhir saat pertama kali dibuka
  useEffect(() => { backfill(); }, [backfill]);

  // Tambahkan data realtime terbaru ke buffer grafik setiap ada perubahan
  useEffect(() => {
    if (realtimeData) addPoint(realtimeData);
  }, [realtimeData, addPoint]);

  // Login admin berhasil: set status + simpan ke localStorage
  const handleLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('admin_logged_in', 'true');
  };

  // Logout admin: hapus status dari localStorage
  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('admin_logged_in');
  };

  return (
    <div className="app-container">
      {/* Sidebar navigasi + status ESP32 */}
      <Sidebar
        section={section}
        setSection={setSection}
        realtimeData={realtimeData}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
        onLoginClick={() => setShowLogin(true)}
        onLogout={handleLogout}
      />
      <main className="main-content">
        {/* Header atas: tombol menu, judul halaman, dan indikator online/offline */}
        <header className="top-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h1 className="page-title">{SECTION_TITLES[section] || 'Dashboard'}</h1>
          <div className="header-right">
            {/* Badge realtime: online jika pembaruan <= 2 menit lalu */}
            <div className="realtime-badge">
              <span className={`status-dot status-${
                realtimeData?.received_at
                  ? (Date.now() - realtimeData.received_at) / 60000 <= 2 ? 'online' : 'offline'
                  : 'unknown'
              }`} />
              <span>{
                realtimeData?.received_at
                  ? (Date.now() - realtimeData.received_at) / 60000 <= 2 ? 'Online' : 'Offline'
                  : 'Memuat...'
              }</span>
            </div>
          </div>
        </header>

        {/* Render halaman sesuai section yang aktif */}
        {section === 'dashboard' && (
          <Dashboard realtimeData={realtimeData} chartPoints={chartPoints} abnormalCount={abnormalData.length} config={config} />
        )}
        {section === 'history' && (
          <History isAdmin={isAdmin} onDataChanged={backfill} /> // onDataChanged: isi ulang buffer setelah hapus data
        )}
        {section === 'abnormal' && <Abnormal isAdmin={isAdmin} />}
        {section === 'telegram' && <Telegram monitor={telegramMonitor} />}
      </main>

      {/* Modal login admin */}
      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
