import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './styles.css'
import './styles_dock_fix_v6.css'
import './styles_used_and_marquee.css'
import './ui-fixes.css'
import './marquee_and_used.runtime.js'
import './home_search.runtime.js'
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App/>
    </BrowserRouter>
  </React.StrictMode>
)
