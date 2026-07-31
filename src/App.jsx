import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import History from './components/History';
import Abnormal from './components/Abnormal';
import Telegram from './components/Telegram';
import LoginModal from './components/LoginModal';
import { useRealtimeData, useAbnormalData, useChartBuffer, useConfigData, useTelegramMonitor } from './hooks';

const SECTION_TITLES = {
  dashboard: 'Dashboard',
  history: 'Riwayat',
  abnormal: 'Data Abnormal',
  telegram: 'Telegram'
};

export default function App() {
  const [section, setSection] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('admin_logged_in') === 'true');
  const { data: realtimeData } = useRealtimeData();
  const { data: abnormalData } = useAbnormalData();
  const { points: chartPoints, addPoint, backfill } = useChartBuffer();
  const config = useConfigData();
  const telegramMonitor = useTelegramMonitor({ config });

  useEffect(() => { backfill(); }, [backfill]);

  useEffect(() => {
    if (realtimeData) addPoint(realtimeData);
  }, [realtimeData, addPoint]);

  const handleLogin = () => {
    setIsAdmin(true);
    localStorage.setItem('admin_logged_in', 'true');
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('admin_logged_in');
  };

  return (
    <div className="app-container">
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
        <header className="top-header">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Buka menu">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <h1 className="page-title">{SECTION_TITLES[section] || 'Dashboard'}</h1>
          <div className="header-right">
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

        {section === 'dashboard' && (
          <Dashboard realtimeData={realtimeData} chartPoints={chartPoints} abnormalCount={abnormalData.length} config={config} />
        )}
        {section === 'history' && (
          <History isAdmin={isAdmin} onDataChanged={backfill} />
        )}
        {section === 'abnormal' && <Abnormal isAdmin={isAdmin} />}
        {section === 'telegram' && <Telegram config={config} monitor={telegramMonitor} />}
      </main>

      {showLogin && (
        <LoginModal
          onLogin={handleLogin}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}
