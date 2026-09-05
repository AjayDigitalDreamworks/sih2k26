import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LanguageProvider } from './contexts/LanguageContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);

// PWA service worker — production only (dev server handles HMR itself).
// The SW provides an offline app shell; GPS observations queued offline are
// marked PENDING on the UI until the backend confirms them (never "LIVE").
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[RAAHI] Service worker registration failed:', err.message);
    });
  });
}
