import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export const LS_KEY_WELCOME_DISMISSED = 'welcome.dismissed.v1'

function Card({ children }) {
  const style = {
    width: '100%',
    maxWidth: '720px',
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 20px 50px rgba(0,0,0,.25)',
    border: '1px solid rgba(0,0,0,.06)',
    padding: '24px',
    textAlign: 'left',
  }
  return <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" style={style}>{children}</section>
}

function WelcomeModal({ showOnStart, setShowOnStart }) {
  const year = useMemo(() => new Date().getFullYear(), [])
  const [leaving, setLeaving] = useState(false)

  const goHomeHard = () => {
    const base =
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ||
      (document.querySelector('base')?.getAttribute('href')) || '/'
    window.location.href = base.endsWith('/') ? base : base + '/'
  }

  const onGetStarted = () => {
    // Persist dismissal, then animate out and hard-navigate
    localStorage.setItem(LS_KEY_WELCOME_DISMISSED, '1')
    setShowOnStart(false)
    setLeaving(true)
    // Safety fallback
    setTimeout(goHomeHard, 300)
  }

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className={(leaving ? 'modal-fade-leave' : 'modal-fade') + ' welcome-backdrop'}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(20,24,28,0.55)',
          backdropFilter: 'blur(16px)',
        }}
        aria-hidden="true"
      />
      {/* Center layer */}
      <div
        className={(leaving ? 'modal-pop-leave' : 'modal-pop') + ' welcome-modal-layer'}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'grid', placeItems: 'center', padding: '16px',
        }}
        onAnimationEnd={() => { if (leaving) goHomeHard() }}
      >
        <Card>
          <span className="inline-block text-xs uppercase tracking-wider" style={{color:'#64748b'}}>Welcome</span>
          <h2 id="welcome-title" className="mt-2 text-3xl md:text-4xl font-bold tracking-tight">
            Hello and welcome to Interface Generator!
          </h2>

          <p className="mt-4 leading-relaxed" style={{color:'#334155'}}>
            This app is <strong>client-side only</strong>. It does <strong>not send any of your data to our servers</strong>.
            Everything you create or import stays inside your browser (IndexedDB/localStorage). You can export or
            back up your work manually at any time. If you clear your browser storage, the local data may be removed.
          </p>

          <ul className="mt-4 list-disc pl-6 space-y-1" style={{color:'#334155'}}>
            <li>No tracking pixels, no cloud sync by default.</li>
            <li>Works offline once loaded (PWA-friendly setup possible).</li>
            <li>Exports are created locally and downloaded by your browser.</li>
          </ul>

          <div className="mt-6" style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:12, padding:16}}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-slate-300"
                checked={showOnStart}
                onChange={(e) => {
                  const v = e.target.checked
                  setShowOnStart(v)
                  if (v) localStorage.removeItem(LS_KEY_WELCOME_DISMISSED)
                  else localStorage.setItem(LS_KEY_WELCOME_DISMISSED, '1')
                }}
              />
              <span className="text-sm" style={{color:'#0f172a'}}>
                Show this welcome screen at startup
              </span>
            </label>
          </div>

          {/* Extra spacing so button doesn't touch the box above */}
          <div className="mt-12" style={{ display:'flex', justifyContent:'center' }}>
            <button
              type="button"
              onClick={onGetStarted}
              style={{
                backgroundColor: '#16a34a',
                color: 'white',
                fontWeight: 600,
                padding: '12px 32px',
                borderRadius: '12px',
                fontSize: '1rem',
                boxShadow: '0 4px 14px rgba(22,163,74,0.4)',
              }}
              className="hover:opacity-90 transition"
            >
              Get started
            </button>
          </div>

          <p className="mt-6 text-xs" style={{color:'#94a3b8'}}>© {year} Interface Generator. Client-side by design.</p>
        </Card>
      </div>
    </>,
    document.body
  )
}

export default function Welcome() {
  const [showOnStart, setShowOnStart] = useState(() => {
    return localStorage.getItem(LS_KEY_WELCOME_DISMISSED) !== '1'
  })

  useEffect(() => {
    if (showOnStart) localStorage.removeItem(LS_KEY_WELCOME_DISMISSED)
    else localStorage.setItem(LS_KEY_WELCOME_DISMISSED, '1')
  }, [showOnStart])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return <WelcomeModal showOnStart={showOnStart} setShowOnStart={setShowOnStart} />
}
