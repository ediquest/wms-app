// src/home_search.runtime.js
import { t as Traw } from './i18n.js'; // ← dostosuj ścieżkę, jeśli trzeba

// Bezpieczny wrapper na t()
const T = (key, fallback) => {
  try {
    const v = Traw ? Traw(key) : undefined;
    return (v ?? fallback ?? key);
  } catch {
    return (fallback ?? key);
  }
};

(() => {
  try {
    if (localStorage.getItem('tcf_disable_home_search') === '1') return;

    const qs = (sel, root = document) => root.querySelector(sel);

    const isHome = () => {
      try {
        const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
        const norm = (s) => (s || '/').replace(/\/+$/, '/');
        return norm(location.pathname) === norm(base);
      } catch {
        return location.pathname === '/';
      }
    };

    const ensureStyles = () => {
      if (qs('#hs-styles')) return;
      const style = document.createElement('style');
      style.id = 'hs-styles';
      style.textContent = `
        .hs-lead-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .hs-lead-row p{margin:0}
        .hs-search{margin-left:auto;display:flex;gap:8px;align-items:center}
        .hs-input{
          min-width:260px;height:36px;
          border:1px solid var(--hairline,#e5e7eb);
          background:var(--inputBg,var(--surface,#fff));
          color:var(--inputText,var(--text,#111));
          border-radius:10px;padding:0 12px;outline:none;
        }
        .hs-input::placeholder{color:var(--muted,#6b7280)}
        .hs-input:focus{
          box-shadow:0 0 0 3px var(--focus-ring,rgba(59,130,246,.35));
          border-color:var(--focus-border,rgba(59,130,246,.6));
        }
        .hs-clear{
          height:36px;padding:0 12px;border-radius:10px;cursor:pointer;
          border:1px solid var(--hairline,#e5e7eb);
          background:var(--btnBg,var(--surface,#fff));color:var(--muted,#374151);
        }
        .hs-clear:hover{filter:brightness(0.98)}
      `;
      document.head.appendChild(style);
    };

    const findLeadParagraphNearGrid = (grid) => {
      const gridRect = grid.getBoundingClientRect();
      let lead = null, best = Infinity;
      document.querySelectorAll('p').forEach((p) => {
        const r = p.getBoundingClientRect();
        const diff = gridRect.top - r.top;
        if (diff > 0 && diff < 220 && diff < best) { best = diff; lead = p; }
      });
      return lead;
    };

    // === Teksty UI – musi być ZANIM zaczniemy montować ===
    const applySearchTexts = () => {
      const input = document.querySelector('.hs-input');
      const clearBtn = document.querySelector('.hs-clear');
      if (input) {
        input.placeholder = T('searchAria','Szukaj…');
        input.setAttribute('aria-label', T('searchAria','Szukaj'));
      }
      if (clearBtn) {
        clearBtn.textContent = T('clear','Wyczyść');
      }
      const injectedLead = document.querySelector('.hs-lead-row > p.muted.hs-injected-label');
      if (injectedLead) {
        injectedLead.textContent = T('home.search.lead','Wybierz interfejs aby rozpocząć');
      }
    };

    const applyFilter = () => {
      const input = document.querySelector('.hs-input');
      if (!input) return;
      const q = input.value.trim().toLowerCase();
      sessionStorage.setItem('hs:lastQuery', q);

      const cards = document.querySelectorAll('.ifaceCard, .interface-card');
      cards.forEach((el) => {
        const name = (el.getAttribute('data-name') || el.textContent || '').toLowerCase();
        const hit = !q || name.includes(q);
        el.style.display = hit ? '' : 'none';
      });

      // Ukryj puste nagłówki, jeśli istnieją
      const titles = document.querySelectorAll('.catTitle');
      titles.forEach((title) => {
        let el = title.nextElementSibling;
        let any = false;
        while (el && !el.classList.contains('catTitle')) {
          if (el.matches('.ifaceCard, .interface-card')) {
            if (el.style.display !== 'none') { any = true; break; }
          } else {
            const inner = el.querySelectorAll('.ifaceCard, .interface-card');
            for (const c of inner) { if (c.style.display !== 'none') { any = true; break; } }
            if (any) break;
          }
          el = el.nextElementSibling;
        }
        title.style.display = any || !q ? '' : 'none';
      });
    };

    const mountSearch = () => {
      if (!isHome()) return;
      if (qs('.hs-search')) { applySearchTexts(); return; } // już jest – tylko odśwież napisy

      const grid = qs('.ifaceGrid, .interfaces-grid');
      if (!grid) return;

      ensureStyles();

      let leadP = qs('p.muted') || findLeadParagraphNearGrid(grid);

      const ui = document.createElement('div');
      ui.className = 'hs-search';
      ui.innerHTML = `
        <input class="hs-input" />
        <button type="button" class="hs-clear"></button>
      `;

      let container;
      if (leadP && leadP.parentElement) {
        if (leadP.parentElement.classList.contains('hs-lead-row')) {
          container = leadP.parentElement;
        } else {
          container = document.createElement('div');
          container.className = 'hs-lead-row';
          leadP.replaceWith(container);
          container.appendChild(leadP);
        }
        container.appendChild(ui);
      } else {
        // Fallback – nad siatką
        container = document.createElement('div');
        container.className = 'hs-lead-row';
        const label = document.createElement('p');
        label.className = 'muted hs-injected-label';
        label.textContent = T('home.search.lead','Wybierz interfejs aby rozpocząć');
        container.appendChild(label);
        container.appendChild(ui);
        grid.parentNode ? grid.parentNode.insertBefore(container, grid) : document.body.prepend(container);
      }

      const input = ui.querySelector('.hs-input');
      const clearBtn = ui.querySelector('.hs-clear');
      const KEY = 'hs:lastQuery';

      input.value = sessionStorage.getItem(KEY) || '';
      applySearchTexts();     // ← ustaw tłumaczenia
      applyFilter();          // ← zastosuj filtr (np. po powrocie)

      input.addEventListener('input', applyFilter);
      clearBtn.addEventListener('click', () => { input.value = ''; applyFilter(); input.focus(); });
    };

    const unmountSearch = () => {
      const ui = qs('.hs-search');
      if (ui) ui.remove();
    };

    const waitForGridThenMount = () => {
      if (!isHome()) return;
      const g = qs('.ifaceGrid, .interfaces-grid');
      if (g) { mountSearch(); return; }
      const mo = new MutationObserver(() => {
        const gg = qs('.ifaceGrid, .interfaces-grid');
        if (gg) { mo.disconnect(); mountSearch(); }
      });
      mo.observe(document, { childList: true, subtree: true });
    };

    // Hook SPA nawigacji
    const NAV_EVENT = 'tcf:navigation';
    const hookHistory = () => {
      const fire = () => window.dispatchEvent(new Event(NAV_EVENT));
      const _ps = history.pushState;
      history.pushState = function (...args) { const r = _ps.apply(this, args); fire(); return r; };
      const _rs = history.replaceState;
      history.replaceState = function (...args) { const r = _rs.apply(this, args); fire(); return r; };
      window.addEventListener('popstate', fire);
    };

    const onNavigate = () => {
      setTimeout(() => {
        if (isHome()) {
          if (!qs('.hs-search')) waitForGridThenMount();
          else applySearchTexts(); // odśwież napisy po powrocie
        } else {
          unmountSearch();
        }
      }, 0);
    };

    // Start
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { hookHistory(); waitForGridThenMount(); }, { once: true });
    } else {
      hookHistory();
      waitForGridThenMount();
    }
    window.addEventListener(NAV_EVENT, onNavigate);

    // Reakcja na i18n
    window.addEventListener('i18n:changed', applySearchTexts);
    const moLang = new MutationObserver(applySearchTexts);
    moLang.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  } catch { /* no-op */ }
})();
