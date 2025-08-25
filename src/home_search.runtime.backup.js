
// home_search.runtime.js
// Adds a search box on the Home page and filters interface tiles.
// Works both locally ("/") and on GitHub Pages (e.g. "/wms-app/").

(function(){
  // Kill-switch: allow disabling via localStorage if needed
  try {
    var DISABLED = (localStorage.getItem('tcf_disable_home_search') === '1') || (window.__DISABLE_HOME_SEARCH__ === true);
    if (DISABLED) { return; }
  } catch(e) {}

  // Normalize trailing slashes to a single slash
  function norm(p){ p = (p || '/'); return /\/$/.test(p) ? p : (p + '/'); }
  function getBase(){
    try { return (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/'; }
    catch(e){ return '/'; }
  }
  function isHome(){
    const base = norm(getBase());
    const here = norm(location.pathname);
    return here === base;
  }

  function removeBox(){
    const el = document.getElementById('homeSearchBox');
    if (el) el.remove();
  }

  // Main ensure function
  function ensureSearchBox(){
    if (!isHome()) { removeBox(); return; }
    if (document.getElementById('homeSearchBox')) return;

    // Try to place near the top content wrapper
    // Prefer inside main.wrap, fall back to body (fixed bar)
    const mainWrap = document.querySelector('main.wrap') || document.querySelector('.wrap') || document.body;

    const bar = document.createElement('div');
    bar.id = 'homeSearchBox';
    bar.style.margin = '8px 0 12px 0';
    bar.style.display = 'flex';
    bar.style.gap = '8px';
    bar.style.alignItems = 'center';

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Szukaj po nazwie lub typie (np. HL15)…';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Szukaj interfejsu');
    input.style.flex = '1';
    input.style.padding = '8px 10px';
    input.style.border = '1px solid var(--hairline, #e5e7eb)';
    input.style.borderRadius = '8px';
    input.style.font = 'inherit';

    const counter = document.createElement('div');
    counter.style.fontSize = '12px';
    counter.style.opacity = '0.75';

    bar.appendChild(input);
    bar.appendChild(counter);

    // Insert before first section/card/list if possible, else append
    const firstCardSection = mainWrap.querySelector('section, .card, .ifaceGrid, .interfaces-grid');
    if (firstCardSection && firstCardSection.parentNode === mainWrap) {
      mainWrap.insertBefore(bar, firstCardSection);
    } else {
      mainWrap.insertBefore(bar, mainWrap.firstChild);
    }

    function filter(){
      const q = input.value.trim().toLowerCase();

      // Candidate selectors for interface tiles
      const cards = Array.from(document.querySelectorAll(
        '.ifaceCard, .interface-card, .card.iface, a.iface, a.interface, a[href*="/interfaces/"], a[href*="/interface/"]'
      ));
      let shown = 0;

      // Simple per-card filter
      for (const el of cards) {
        const name = (el.getAttribute('data-name') || el.textContent || '').toLowerCase();
        const type = (el.getAttribute('data-type') || '').toLowerCase();
        const hit = !q || name.includes(q) || type.includes(q);
        el.style.display = hit ? '' : 'none';
        if (hit) shown++;
      }

      // Optional: hide empty category groups if we can detect them
      const groups = Array.from(document.querySelectorAll('.catTitle')).map(ct => ct.parentElement);
      for (const g of groups) {
        const visibleCards = g.querySelectorAll('.ifaceCard:not([style*="display: none"]) , .interface-card:not([style*="display: none"]) , a.iface:not([style*="display: none"]), a.interface:not([style*="display: none"])');
        g.style.display = visibleCards.length ? '' : 'none';
      }

      counter.textContent = shown ? `Widocznych: ${shown}` : 'Brak wyników';
    }

    input.addEventListener('input', filter);
    // If the app re-renders Home, try to re-apply filter
    const obs = new MutationObserver((muts) => { filter(); });
    obs.observe(document.body, { subtree: true, childList: true });
    // Save for cleanup
    bar._dispose = () => obs.disconnect();

    // Prefill from hash (?q=)
    try {
      const usp = new URLSearchParams(location.search);
      const preset = usp.get('q');
      if (preset) { input.value = preset; }
    } catch {}

    filter();
  }

  function tick(){
    try { ensureSearchBox(); } catch(e){ /* noop */ }
  }

  if (document.readyState !== 'loading') tick();
  document.addEventListener('DOMContentLoaded', tick);
  // SPA navigations
  window.addEventListener('popstate', tick);
  // In case routers change without popstate
  setInterval(tick, 800);
})();
