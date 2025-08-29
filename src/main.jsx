import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import './styles_dock_fix_v6.css'
import './styles_used_and_marquee.css'
import './ui-fixes.css'
import './i18n.js'
import './marquee_and_used.runtime.js'
import './home_search.runtime.js'

// w src/main.jsx (po imporcie i18n)
import { t } from './i18n.js';
import NotesDock from './components/NotesDock.jsx';
document.title = t('appTitle', 'Generator Interfejsów');
// i nasłuch na zmianę języka (jeśli masz już event i18n:changed):
window.addEventListener('i18n:changed', () => {
  document.title = t('appTitle', 'Generator Interfejsów');
});


createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App/>
      <NotesDock />
    </BrowserRouter>
  </React.StrictMode>
)