/**
 * LoginModal.jsx — Modal login admin.
 * Memvalidasi password (VITE_ADMIN_PASSWORD dari .env). Jika benar memanggil
 * onLogin() lalu menutup modal; jika salah menampilkan pesan "Password salah".
 * Klik di luar modal (overlay) menutup modal tanpa login.
 */
import { useState } from 'react';

// Password admin dari variabel env (.env)
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

export default function LoginModal({ onLogin, onClose }) {
  const [password, setPassword] = useState(''); // Isi input password
  const [error, setError] = useState(''); // Pesan error

  // Validasi saat form disubmit
  const handleSubmit = (e) => {
    e.preventDefault(); // Cegah reload halaman
    if (password === ADMIN_PASSWORD) {
      onLogin(); // Berhasil: panggil callback login
      onClose(); // Tutup modal
    } else {
      setError('Password salah'); // Gagal: tampilkan error
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* Klik di dalam modal tidak menutup modal (stopPropagation) */}
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Login Admin</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            className="modal-input"
            placeholder="Masukkan password admin"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }} // Hapus error saat mengetik
            autoFocus
          />
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary">Masuk</button>
          </div>
        </form>
      </div>
    </div>
  );
}