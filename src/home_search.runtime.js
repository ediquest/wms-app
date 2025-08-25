
// /home_search.runtime.js
// Injects a search box on the Home page and filters interface tiles in real time.

(function(){
  const isHome = () => {
    const base = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
    const p = location.pathname;
    // Normalize trailing slashes
    const norm = (s) => (s || '/').replace(/\/+$/, '/') ;
    return norm(p) === norm(base);
  };

  function ensureSearchBox(){
    if(!isHome()) return;
    if(document.querySelector('#homeSearchBox')) return;

    // Try to place near the top content wrapper
    const wrap = document.querySelector('.content .wrap') || document.querySelector('.wrap');
    if(!wrap) return;

    const bar = document.createElement('div');
    bar.id = 'homeSearchBox';
    bar.style.display = 'flex';
    bar.style.justifyContent = 'flex-end';
    bar.style.marginBottom = '8px';

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Szukaj interfejsu...';
    input.style.width = '320px';
    input.style.maxWidth = '100%';
    input.style.padding = '8px 10px';
    input.style.borderRadius = '10px';
    input.style.border = '1px solid var(--border)';
    input.style.background = 'var(--inputBg)';
    input.style.color = 'var(--inputText)';
    input.style.outline = 'none';

    bar.appendChild(input);
    wrap.prepend(bar);

    function filter(){
      const q = input.value.trim().toLowerCase();
      // support both grids
      const cards = Array.from(document.querySelectorAll('.ifaceGrid a, .tiles a, .ifaceCard'));
      cards.forEach(el => {
        const text = (el.getAttribute('data-title') || el.textContent || '').toLowerCase();
        el.style.display = text.includes(q) ? '' : 'none';
      });
    }
    input.addEventListener('input', filter);
    filter();
  }

  function tick(){
    try{ ensureSearchBox(); }catch(e){ /* noop */ }
  }

  if(document.readyState !== 'loading') tick();
  document.addEventListener('DOMContentLoaded', tick);
  // also re-run on navigation within SPA
  window.addEventListener('popstate', tick);
  // in case app does client navigation without popstate
  setInterval(tick, 800);
})();
