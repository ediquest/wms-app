
// /marquee_and_used.runtime.js
// 1) Adds "used" highlight based on current workspace
// 2) Smooth marquee-on-hover for long labels (only for interface items)

(function(){
  function readWorkspace(){
    try{
      // try newer scheme
      const cur = localStorage.getItem('tcf_ws_current');
      if(cur){
        const key1 = 'tcf_ws_' + cur;
        const raw1 = localStorage.getItem(key1);
        if(raw1){
          const ws = JSON.parse(raw1);
          if(ws && Array.isArray(ws.interfaces)) return ws.interfaces.slice();
          if(ws && ws.ifaces && Array.isArray(ws.ifaces)) return ws.ifaces.slice();
        }
      }
      // try legacy single workspace key
      const raw2 = localStorage.getItem('tcf_workspace');
      if(raw2){
        const ws2 = JSON.parse(raw2);
        if(ws2 && Array.isArray(ws2.interfaces)) return ws2.interfaces.slice();
        if(ws2 && ws2.ifaces && Array.isArray(ws2.ifaces)) return ws2.ifaces.slice();
      }
    }catch(e){}
    return [];
  }

  function parseIfaceIdFromHref(href){
    try{
      const m = href.match(/\/iface\/([^/?#]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    }catch(e){ return null; }
  }

  function markUsed(){
    const used = new Set(readWorkspace());
    const sideLinks = document.querySelectorAll('.sidebar a.s-item[href*="/iface/"]');
    sideLinks.forEach(a => {
      const id = parseIfaceIdFromHref(a.getAttribute('href')||'');
      if(!id) return;
      if(used.has(id)) a.classList.add('used'); else a.classList.remove('used');
    });
    const homeCards = document.querySelectorAll('.ifaceGrid a[href*="/iface/"], .tiles a[href*="/iface/"], a.ifaceCard[href*="/iface/"]');
    homeCards.forEach(a => {
      const id = parseIfaceIdFromHref(a.getAttribute('href')||'');
      if(!id) return;
      if(used.has(id)) a.classList.add('used'); else a.classList.remove('used');
    });
  }

  // Marquee on hover for menu items only (not headers)
  function applyMarquee(){
    document.querySelectorAll('.sidebar .s-item .s-item-title').forEach(el => {
      if(el.dataset.marqueeApplied) return;
      el.dataset.marqueeApplied = '1';
      el.addEventListener('mouseenter', () => {
        const w = el.scrollWidth;
        const box = el.clientWidth;
        if(w <= box + 4) return;
        const delta = w - box + 24;
        el.style.transition = 'transform 6s linear';
        el.style.transform = `translateX(-${delta}px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .25s ease';
        el.style.transform = 'translateX(0)';
      });
    });
  }

  function tick(){
    try{ markUsed(); applyMarquee(); }catch(e){}
  }

  if(document.readyState !== 'loading') tick();
  document.addEventListener('DOMContentLoaded', tick);
  window.addEventListener('storage', tick); // live when workspace saved from other tabs
  // app SPA updates
  window.addEventListener('popstate', tick);
  setInterval(tick, 1000);
})();
