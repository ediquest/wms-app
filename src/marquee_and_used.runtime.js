
/* marquee_and_used.runtime.js (safe, ES5-compatible) */
(function(){
  function SIDEBAR(){ return document.querySelector('.sidebar') || document.querySelector('#sidebar') || document.body; }
  function applyMarqueeOnce(){
    var sb = SIDEBAR(); if (!sb) return;
    var nodes = sb.querySelectorAll('a[href^="/iface/"] .s-item-title');
    for (var i=0; i<nodes.length; i++){
      var titleNode = nodes[i];
      if (titleNode.dataset && titleNode.dataset.marquee === '1') continue;
      var text = (titleNode.textContent || '').trim(); if (!text) continue;
      if (titleNode.dataset) titleNode.dataset.marquee = '1';
      var span = document.createElement('span'); span.className='marquee'; span.textContent=text;
      titleNode.innerHTML=''; titleNode.appendChild(span);
      var onEnter=(function(node,inner){return function(){
        var box=node.getBoundingClientRect(), full=inner.scrollWidth, avail=Math.floor(box.width), dist=Math.max(0, full-avail);
        if (dist<=1) return;
        inner.style.transition='none'; inner.style.transform='translateX(0px)';
        setTimeout(function(){ var d=Math.max(200, Math.round((dist/70)*1000)); inner.style.transition='transform '+d+'ms linear'; inner.style.transform='translateX(-'+dist+'px)'; },0);
      };})(titleNode,span);
      var onLeave=(function(inner){return function(){ inner.style.transition='transform 180ms ease-out'; inner.style.transform='translateX(0px)'; };})(span);
      titleNode.addEventListener('mouseenter', onEnter);
      titleNode.addEventListener('focus', onEnter, true);
      titleNode.addEventListener('mouseleave', onLeave);
      titleNode.addEventListener('blur', onLeave, true);
    }
  }
  function readValuesMap(){ try { return JSON.parse(localStorage.getItem('tcf_values')||'{}')||{}; } catch(e){ return {}; } }
  function readWorkspaceState(){
    var wsId = localStorage.getItem('tcf_ws_current');
    if (!wsId){ try { var meta=JSON.parse(localStorage.getItem('tcf_workspace')||'null'); wsId = meta && meta.current; } catch(e){} }
    var list=[]; try { var raw=localStorage.getItem('tcf_ws_active_ifaces'); if (raw) list=JSON.parse(raw)||[]; } catch(e){}
    return { wsId: wsId, activeIfaces: list };
  }
  function idFromLink(a){ try { var href=a.getAttribute('href')||''; var m=href.match(/^\/iface\/([^\/]+)/); return m && m[1]; } catch(e){ return null; } }
  function closestCard(a){ var el=a; while(el && el!==document.body){ if(el.classList && el.classList.contains('iface-card')) return el; el=el.parentNode; } return a; }
  function computeUsedIfaceIds(){
    var used={}; try{
      var map = readValuesMap(); for (var k in map){ if (map.hasOwnProperty(k)) used[k]=true; }
      var ws = readWorkspaceState(); if(ws && ws.activeIfaces && ws.activeIfaces.length){ for (var i=0;i<ws.activeIfaces.length;i++) used[ws.activeIfaces[i]] = true; }
    }catch(e){} return used;
  }
  function paintUsed(){
    var usedMap = computeUsedIfaceIds();
    var sb = SIDEBAR();
    if (sb){
      var links = sb.querySelectorAll('a[href^="/iface/"]');
      for (var i=0;i<links.length;i++){
        var a=links[i]; var id=idFromLink(a); var on=id && usedMap[id];
        a.classList.toggle('used', !!on);
        var item = a.closest ? (a.closest('.s-item') || a) : a;
        if (item && item.classList) item.classList.toggle('used', !!on);
      }
    }
    var all = document.querySelectorAll('a[href^="/iface/"]');
    for (var j=0;j<all.length;j++){
      var link = all[j]; if (sb && sb.contains(link)) continue;
      var id2 = idFromLink(link); var on2 = id2 && usedMap[id2];
      var card = closestCard(link); if (card && card.classList) card.classList.toggle('used', !!on2);
    }
  }
  var mo = new MutationObserver(function(){ applyMarqueeOnce(); paintUsed(); });
  mo.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('storage', function(e){
    if (!e || !e.key) return;
    if (/^tcf_(values|ws_)/.test(e.key) || e.key==='tcf_ws_current' || e.key==='tcf_ws_active_ifaces'){ paintUsed(); }
  });
  applyMarqueeOnce(); paintUsed();
})();
