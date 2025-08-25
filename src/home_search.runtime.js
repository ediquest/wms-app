// src/home_search.runtime.js
(() => {
  try {
    if (localStorage.getItem('tcf_disable_home_search') === '1') return;

    const isHome = () => {
      try {
        const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
        const norm = (s) => (s || '/').replace(/\/+$/, '/');
        return norm(location.pathname) === norm(base);
      } catch {
        return location.pathname === '/';
      }
    };

    const qs = (sel, root = document) => root.querySelector(sel);

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
      // Szukamy najbliższego <p> powyżej siatki (to powinno być „Wybierz interfejs aby rozpocząć”)
      const gridRect = grid.getBoundingClientRect();
      let lead = null, best = Infinity;
      document.querySelectorAll('p').forEach((p) => {
        const r = p.getBoundingClientRect();
        const diff = gridRect.top - r.top;
        if (diff > 0 && diff < 220) { // p nad siatką, w sensownym zasięgu
          if (diff < best) { best = diff; lead = p; }
        }
      });
      return lead;
    };

    const inject = () => {
      if (!isHome()) return;
      // unikamy wielokrotnego montowania
      if (qs('.hs-search')) return;

      // siatka kart (obsługuję dwie możliwe klasy)
      const grid = qs('.ifaceGrid, .interfaces-grid');
      if (!grid) return; // poczekamy na observera

      // znajdź paragraf z „Wybierz interfejs aby rozpocząć” (lub najbliższy p nad siatką)
      let leadP = qs('p.muted') || findLeadParagraphNearGrid(grid);

      ensureStyles();

      // UI
      const ui = document.createElement('div');
      ui.className = 'hs-search';
      ui.innerHTML = `
        <input aria-label="Szukaj" class="hs-input" placeholder="Szukaj..." />
        <button type="button" class="hs-clear">Wyczyść</button>
      `;

      // umieszczenie: ten sam wiersz, po prawej od leadP
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
        // Fallback: nad siatką
        container = document.createElement('div');
        container.className = 'hs-lead-row';
        if (grid.parentNode) {
          grid.parentNode.insertBefore(container, grid);
        } else {
          document.body.insertBefore(container, document.body.firstChild);
        }
        const label = document.createElement('p');
        label.className = 'muted';
        label.textContent = document.documentElement.lang?.startsWith('pl')
          ? 'Wybierz interfejs aby rozpocząć'
          : 'Choose an interface to start';
        container.appendChild(label);
        container.appendChild(ui);
      }

      const input = ui.querySelector('.hs-input');
      const clearBtn = ui.querySelector('.hs-clear');
      const KEY = 'hs:lastQuery';

      input.value = sessionStorage.getItem(KEY) || '';

      const apply = () => {
        const q = input.value.trim().toLowerCase();
        sessionStorage.setItem(KEY, q);

        const cards = document.querySelectorAll('.ifaceCard, .interface-card');
        cards.forEach((el) => {
          const name = (el.getAttribute('data-name') || el.textContent || '').toLowerCase();
          const hit = !q || name.includes(q);
          el.style.display = hit ? '' : 'none';
        });

        // Ukryj puste nagłówki kategorii (jeśli występują)
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

      input.addEventListener('input', apply);
      clearBtn.addEventListener('click', () => { input.value = ''; apply(); input.focus(); });

      // Pierwsze zastosowanie filtra (przywrócenie zapytania)
      apply();
    };

    const waitAndInject = () => {
      if (!isHome()) return;
      const gridNow = qs('.ifaceGrid, .interfaces-grid');
      if (gridNow) { inject(); return; }
      const mo = new MutationObserver(() => {
        const g = qs('.ifaceGrid, .interfaces-grid');
        if (g) { mo.disconnect(); inject(); }
      });
      mo.observe(document, { childList: true, subtree: true });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', waitAndInject, { once: true });
    } else {
      waitAndInject();
    }
  } catch { /* no-op */ }
})();
