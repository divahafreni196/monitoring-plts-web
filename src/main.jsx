/**
 * main.jsx — Titik masuk (entry point) aplikasi.
 * Merender komponen utama <App /> ke dalam elemen #root pada index.html
 * menggunakan React 18 (ReactDOM.createRoot) dengan mode StrictMode.
 * File ini hanya berfungsi sebagai penghubung antara index.html dan komponen App.
 */
import React from 'react'; // React API dasar (StrictMode)
import ReactDOM from 'react-dom/client'; // Renderer React 18
import App from './App'; // Komponen akar aplikasi
import './App.css'; // Gaya global seluruh aplikasi

// Pasang (mount) aplikasi React ke elemen <div id="root"> di index.html
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode> {/* StrictMode: deteksi masalah pada mode development */}
    <App />
  </React.StrictMode>
);
  