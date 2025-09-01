import { useEffect, useState } from 'react'
import './ui-fixes.css';
import { Routes, Route, Link, Navigate } from 'react-router-dom'
import Interfaces from './pages/Interfaces.jsx'
import Home from './pages/Home.jsx'
import Admin from './pages/Admin.jsx'
import Sidebar from './components/Sidebar.jsx'
import { loadConfig, applyTheme, setThemeLight, setThemeDark, THEME_LIGHT, getRole, setRole, THEMES, getThemeId, setThemeById } from './utils.js'
import { getLang, setLang, t } from './i18n.js'
import { ModalProvider } from './components/Modal.jsx'

// 👉 importujemy stronę powitalną i helper
import Welcome, { LS_KEY_WELCOME_DISMISSED } from './pages/Welcome.jsx'

export default function App(){
  const [cfg, setCfg] = useState(loadConfig());
  const [lang, setLangState] = useState(getLang());
  const [scheme, setScheme] = useState(() => getThemeId(cfg));
  const [role, setRoleState] = useState(getRole());

  useEffect(() => { applyTheme(cfg.theme); }, []);

  const changeLang = (e) => { const v=e.target.value; setLang(v); setLangState(v); setCfg(loadConfig()); try { window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang: v } })); } catch(_){} };
  const changeScheme = (e) => { const v=e.target.value; setScheme(v); setThemeById(v); setCfg(loadConfig()); };;
  const changeRole = (e) => { const v=e.target.value; setRole(v); setRoleState(v); };

  // 👉 sprawdzamy preferencję welcome
  const shouldShowWelcome = localStorage.getItem(LS_KEY_WELCOME_DISMISSED) !== '1';

  return (
    <ModalProvider>
      <header className="topbar">
        <div className="wrap" style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <h1 style={{margin:0}}><Link className="link" to="/">{cfg.siteTitle || t('appTitle')}</Link></h1>
          <nav style={{marginLeft:'auto',display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
  <label className="inline">
    <span>{t('language')}:</span>
    <select value={lang} onChange={changeLang}>
      <option value="en">English</option>
      <option value="pl">Polski</option>
      <option value="fr">Français</option>
      <option value="cs">Čeština</option>
      <option value="de">Deutsch</option>
      <option value="es">Español</option>
      <option value="it">Italiano</option>
    </select>
  </label>
  <label className="inline">
    <span>{t('scheme')}:</span>
    <select value={scheme} onChange={changeScheme}>
      {THEMES.map(th => <option key={th.id} value={th.id}>{th.name}</option>)}
    </select>
  </label>
  <Link to="/admin" className="btn adminBtn">
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="currentColor" d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Zm9.5 3.5c0 .5-.04.98-.12 1.45l2.04 1.59-2 3.46-2.4-.97c-.64.5-1.34.9-2.1 1.18l-.36 2.54h-4l-.36-2.54a7.97 7.97 0 0 1-2.09-1.18l-2.41.97-2-3.46 2.04-1.59A8.9 8.9 0 0 1 2.5 12c0-.5.04-.98.12-1.45L.58 8.96l2-3.46 2.41.97c.64-.5 1.34-.9 2.09-1.18l.36-2.54h4l.36 2.54c.76.28 1.46.68 2.1 1.18l2.4-.97 2 3.46-2.04 1.59c.08.47.12.95.12 1.45Z"/>
    </svg>
    {t?.('adminPanel') || 'Panel administracyjny'}
  </Link>
</nav>
        </div>
      </header>
      <div className="layout">
        <Sidebar/>
        <div className="content">
          <Routes>
            {/* 👉 warunkowe przekierowanie na welcome */}
            <Route path="/" element={shouldShowWelcome ? <Navigate to="/welcome" replace /> : <Interfaces/>} />
            <Route path="/welcome" element={<Welcome/>} />
            <Route path="/iface/:id" element={<Home/>} />
            <Route path="/admin" element={<Admin role={role}/>} />
          </Routes>
          <footer className="footer">
            <div className="wrap muted">© {new Date().getFullYear()} by Adrian Sarczynski</div>
          </footer>
        </div>
      </div>
    </ModalProvider>
  )
}
