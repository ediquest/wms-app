import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import './styles_dock_fix_v6.css'
import './styles_used_and_marquee.css'
import './ui-fixes.css'
import './marquee_and_used.runtime.js'
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App/>
    </BrowserRouter>
  </React.StrictMode>
)
// przechwytywanie kliknięć w <a href="/..."> i przepisywanie pod /wms-app/
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="/"]');
  if (!a) return;
  const to = a.getAttribute('href'); // np. "/iface/foo"
  // wewnętrzne linki tylko
  if (a.origin === location.origin) {
    e.preventDefault();
    const pref = import.meta.env.BASE_URL || '/';
    const clean = to.replace(/^\/+/, ''); // "iface/foo"
    // użyj nawigacji routera jeśli masz:
    if (window.__APP_NAV__) { window.__APP_NAV__(`/${clean}`); }
    else { window.location.href = pref + clean; }
  }
}, { capture: true });
