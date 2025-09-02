import React, { useEffect, useState } from 'react';

export default function SidebarToggle({
  storageKey = 'ui.sidebarOpen',
  className = '',
  dock = false,   // stick to sidebar edge but live outside it
  size = 'sm',    // 'sm' | 'md'
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
  try {
    const saved = localStorage.getItem(storageKey);
    const initial = saved == null ? true : saved === '1';
    setOpen(initial);
    // explicit add/remove to avoid stale 'toggle' behavior
    if (initial) document.body.classList.remove('sidebar-collapsed');
    else document.body.classList.add('sidebar-collapsed');
  } catch {}
}, [storageKey]);
function toggle() {
    setOpen(prev => {
      const next = !prev;
      try {
        document.body.classList.toggle('sidebar-collapsed', !next);
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {}
      return next;
    });
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={!open}
      aria-label={open ? 'Hide menu' : 'Show menu'}
      title={open ? 'Hide menu' : 'Show menu'}
      className={[
        'sidebar-toggle',
        size === 'sm' ? 'sidebar-toggle--sm' : 'sidebar-toggle--md',
        dock ? 'sidebar-toggle--dock' : '',
        open ? '' : 'is-collapsed',
        className,
      ].join(' ')}
    >
      <span className="bars" aria-hidden="true"><i/><i/><i/></span>
    </button>
  );
}
