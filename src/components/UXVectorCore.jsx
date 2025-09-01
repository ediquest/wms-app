import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import LightModal from './LightModal.jsx';

/**
 * UXVectorCore — Snake-like minigame inside LightModal (no iframe).
 * - Auto scales to viewport (min scale 0.5)
 * - Stronger dark backdrop
 * - Hiscore in localStorage under 'ux_rt_hiscore'
 */
export default function UXVectorCore({ open, onClose }) {
  // DOM refs
  const canvasRef = useRef(null), overlayRef = useRef(null);
  const scoreRef = useRef(null), hiscoreRef = useRef(null);
  const startBtnRef = useRef(null), resetBtnRef = useRef(null), dpadRef = useRef(null);
  const phoneRef = useRef(null);

  // timers / audio
  const timerRef = useRef(null), audioCtxRef = useRef(null);

  // scaling
  const [scale, setScale] = useState(1);
  const baseRef = useRef({ w: 0, h: 0 });

  // measure & scale when modal opens / on resize
  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const node = phoneRef.current;
      if (!node) return;
      const prev = node.style.transform;
      node.style.transform = 'none';
      const rect = node.getBoundingClientRect();
      if (!baseRef.current.w || !baseRef.current.h) {
        baseRef.current = { w: rect.width, h: rect.height }; // natural size @ scale=1
      }
      // available viewport inside modal (rough padding)
      const padW = 72;
      const padH = 120;
      const availW = Math.max(320, window.innerWidth - padW);
      const availH = Math.max(320, window.innerHeight - padH);
      const s = Math.min(availW / baseRef.current.w, availH / baseRef.current.h, 1);
      node.style.transform = prev || '';
      setScale(Math.max(0.5, s)); // min scale
    };
    measure();
    window.addEventListener('resize', measure);
    const id = setTimeout(measure, 0);
    return () => { window.removeEventListener('resize', measure); clearTimeout(id); };
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      try { if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close(); } catch {}
      return;
    }

    const CELL = 24, COLS = 42, ROWS = 24, START_LEN = 5, START_SPEED = 7, WALLS_ARE_SOLID = true;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const getVar = (name, fallback) => {
      const root = canvas.closest('.uxv-root');
      const v = root ? getComputedStyle(root).getPropertyValue(name).trim() : '';
      return v || fallback;
    };
    const COLOR_BG    = getVar('--lcd-bg',    '#a9c868');
    const COLOR_BG2   = getVar('--lcd-bg-2',  '#98ba57');
    const COLOR_PIXEL = getVar('--lcd-pixel', '#0d2b0d');
    const COLOR_DIM   = getVar('--lcd-dim',   '#184418');

    let snake, dir, nextDir, food, score, hiscore, speed, running = false, gameOver = false;

    // audio (best-effort)
    try { audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    const beep = (freq=440, dur=0.06, type='square', gain=0.02) => {
      const a = audioCtxRef.current; if (!a) return;
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = freq; g.gain.value = gain;
      o.connect(g); g.connect(a.destination);
      o.start(); o.stop(a.currentTime + dur);
    };

    const localKey = 'ux_rt_hiscore';

    function showOverlay(show, message){
      const ov = overlayRef.current;
      if (!ov) return;
      if (show) {
        if (message) {
          const lines = String(message).split('\n');
          ov.innerHTML = `<div class="panel"><h1>${lines[0]}</h1>${lines.slice(1).map(p=>`<p>${p}</p>`).join('')}</div>`;
        }
        ov.style.display = 'flex';
      } else {
        ov.style.display = 'none';
      }
    }
    const hideOverlay = () => showOverlay(false);

    function clearLCD(){
      const g = ctx.createLinearGradient(0,0,0,canvas.height);
      g.addColorStop(0, COLOR_BG);
      g.addColorStop(1, COLOR_BG2);
      ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    const drawPixelCell = (cx,cy,dim=false) => {
      ctx.fillStyle = dim ? COLOR_DIM : COLOR_PIXEL;
      ctx.fillRect(cx*CELL, cy*CELL, CELL, CELL);
    };
    function draw(){
      clearLCD();
      const t = Date.now()>>7;
      const blink = (t % 2) === 0;
      if (blink) drawPixelCell(food.x, food.y, false); else drawPixelCell(food.x, food.y, true);
      for(let i=0;i<snake.length;i++) drawPixelCell(snake[i].x, snake[i].y, false);
      if (gameOver) {
        ctx.fillStyle = 'rgba(0,0,0,.08)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }
    }

    function placeFood(){
      do {
        food = { x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS) };
      } while (snake.some(s=>s.x===food.x && s.y===food.y));
    }

    function endGame(){
      running = false; gameOver = true;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      draw();
      showOverlay(true, `Koniec gry • wynik: ${score}\n[R] — zagraj ponownie`);
      beep(220, .08, 'square', .03); setTimeout(()=>beep(180,.1,'square',.03), 90);
    }

    function runLoop(){
      if (timerRef.current) { clearInterval(timerRef.current); }
      const interval = Math.max(40, Math.floor(1000 / speed));
      timerRef.current = setInterval(tick, interval);
    }

    function setDir(nx,ny){
      if (nx === -dir.x && ny === -dir.y) return;
      nextDir = {x:nx, y:ny};
    }

    function tick(){
      dir = nextDir;
      let nx = snake[0].x + dir.x;
      let ny = snake[0].y + dir.y;

      if (WALLS_ARE_SOLID) {
        if (nx<0||ny<0||nx>=COLS||ny>=ROWS) return endGame();
      } else {
        if (nx<0) nx=COLS-1; if (nx>=COLS) nx=0; if (ny<0) ny=ROWS-1; if (ny>=ROWS) ny=0;
      }

      if (snake.some(seg=>seg.x===nx && seg.y===ny)) return endGame();

      snake.unshift({x:nx,y:ny});

      if (nx===food.x && ny===food.y){
        score++; if (scoreRef.current) scoreRef.current.textContent = String(score);
        if (score > hiscore) { hiscore=score; localStorage.setItem(localKey, String(hiscore)); if (hiscoreRef.current) hiscoreRef.current.textContent = String(hiscore); }
        beep(880, .05, 'square', .03);
        if (score % 5 === 0) { speed += 1; runLoop(); beep(1320, .06, 'square', .02); }
        placeFood();
      } else {
        snake.pop();
      }

      draw();
    }

    function start(){
      if (gameOver) { reset(); return; }
      running = !running;
      if (running) { hideOverlay(); runLoop(); }
      else if (timerRef.current) { clearInterval(timerRef.current); timerRef.current=null; }
    }
    function reset(){
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current=null; }
      init();
    }

    function init(){
      const prior = Number(localStorage.getItem(localKey) || localStorage.getItem('snake_hiscore') || 0);
      if (hiscoreRef.current) hiscoreRef.current.textContent = String(prior);
      hiscore = prior;

      const startX = Math.floor(COLS/2), startY = Math.floor(ROWS/2);
      snake = [];
      for(let i=0;i<START_LEN;i++) snake.push({x:startX - i, y:startY});
      dir = {x:1,y:0}; nextDir = {x:1,y:0};
      score = 0; if (scoreRef.current) scoreRef.current.textContent = '0';
      speed = START_SPEED; running = false; gameOver = false;
      placeFood(); draw(); showOverlay(true);
    }

    const onKey = (e) => {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      switch (e.key) {
        case 'ArrowUp': case 'w': case 'W': setDir(0,-1); break;
        case 'ArrowDown': case 's': case 'S': setDir(0, 1); break;
        case 'ArrowLeft': case 'a': case 'A': setDir(-1,0); break;
        case 'ArrowRight': case 'd': case 'D': setDir(1, 0); break;
        case ' ': start(); break;
        case 'r': case 'R': reset(); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey, { capture:true });

    const sb = startBtnRef.current, rb = resetBtnRef.current;
    if (sb) sb.addEventListener('click', start);
    if (rb) rb.addEventListener('click', reset);
    if (dpadRef.current) {
      dpadRef.current.querySelectorAll('.p').forEach(el => {
        el.addEventListener('click', () => {
          const d = el.getAttribute('data-dir');
          if (d==='up') setDir(0,-1);
          if (d==='down') setDir(0,1);
          if (d==='left') setDir(-1,0);
          if (d==='right') setDir(1,0);
          if (d==='center') start();
        });
      });
    }

    init();

    return () => {
      window.removeEventListener('keydown', onKey, { capture:true });
      try { if (sb) sb.removeEventListener('click', start); } catch {}
      try { if (rb) rb.removeEventListener('click', reset); } catch {}
      try {
        if (dpadRef.current) {
          dpadRef.current.querySelectorAll('.p').forEach(el => {
            const clone = el.cloneNode(true); el.parentNode.replaceChild(clone, el);
          });
        }
      } catch {}
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      try { if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close(); } catch {}
    };
  }, [open]);

  const outerW = baseRef.current.w ? baseRef.current.w * scale : undefined;
  const outerH = baseRef.current.h ? baseRef.current.h * scale : undefined;

  return (
    <LightModal
      open={open}
      onClose={onClose}
      title={null}
      footer={null}
      // jeśli LightModal to obsługuje:
      backdropStyle={{ background: 'rgba(10,14,20,.85)', backdropFilter: 'blur(1.5px)' }}
    >
      <div className="uxv-root" style={{display:'flex',alignItems:'center',justifyContent:'center', width: outerW, height: outerH}}>
        {/* Scoped styles */}
        <style>{`
          .uxv-root{
            --lcd-bg:#a9c868; --lcd-bg-2:#98ba57; --lcd-pixel:#0d2b0d; --lcd-dim:#184418;
            --bezel:#0f1d0f; --bezel-2:#213a21; --accent:#3e5f3e;
          }
          .uxv-phone{ padding:18px; border-radius:36px; background: linear-gradient(160deg, #1b311b, #0d1d0d 60%);
            box-shadow: 0 30px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.03); }
          .uxv-screen-wrap{ width: 1092px; border-radius:18px; padding:14px; background: linear-gradient(180deg, var(--bezel-2), var(--bezel));
            box-shadow: inset 0 0 0 2px rgba(255,255,255,.04), inset 0 0 12px rgba(0,0,0,.75); position:relative; }
          .uxv-screen{ position:relative; width:1008px; height:576px; margin:0 auto; border-radius:8px; overflow:hidden;
            background: linear-gradient(180deg, var(--lcd-bg), var(--lcd-bg-2)); image-rendering:pixelated;
            box-shadow: inset 0 0 0 2px rgba(0,0,0,.25), inset 0 0 30px rgba(0,0,0,.25); }
          .uxv-scanlines{ position:absolute; inset:0; pointer-events:none; background: repeating-linear-gradient(
              to bottom, rgba(0,0,0,.05) 0px, rgba(0,0,0,.05) 1px, transparent 2px, transparent 4px); mix-blend-mode:multiply; }
          .uxv-hud{ display:flex; justify-content:space-between; align-items:center; color:var(--lcd-pixel);
            text-transform:uppercase; font-size:13px; opacity:.9; margin:8px 0 4px; padding:0 6px; }
          .uxv-btns{ display:flex; gap:8px; justify-content:center; margin-top:12px; }
          .uxv-btn{ background: linear-gradient(180deg, #243f24, #162816); color:#cfe6a7; border:1px solid #0a190a; padding:8px 10px; border-radius:10px; font-weight:700; cursor:pointer; min-width:90px; text-align:center; box-shadow:0 2px 0 #0a190a; }
          .uxv-btn:active{ transform:translateY(1px); box-shadow:0 1px 0 #0a190a }
          .uxv-hint{ color:#b7d283; font-size:12px; text-align:center; margin-top:6px; opacity:.85 }
          .uxv-overlay{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:var(--lcd-pixel);
            font-weight:800; text-align:center; background:rgba(0,0,0,.0); }
          .uxv-overlay .panel{ background: rgba(255,255,255,.06); border: 2px solid rgba(0,0,0,.25); box-shadow: inset 0 0 12px rgba(0,0,0,.15);
            padding:14px 16px; border-radius:6px; backdrop-filter: blur(.5px); }
          .uxv-dpad{ display:grid; grid-template-columns:40px 40px 40px; grid-template-rows:40px 40px 40px; gap:6px; justify-content:center; margin-top:10px }
          .uxv-dpad .p{ background: linear-gradient(180deg, #243f24, #162816); border:1px solid #0a190a; border-radius:8px; color:#cfe6a7; font-weight:800; display:flex; align-items:center; justify-content:center; user-select:none }
          .uxv-dpad .p:active{ transform:translateY(1px) }
          .uxv-dpad .empty{ background: transparent; border:none }
        `}</style>

        <div ref={phoneRef} className="uxv-phone" style={{ transform:`scale(${scale})`, transformOrigin:'center' }}>
          <div className="uxv-screen-wrap">
            <div className="uxv-hud">
              <div>Wynik: <span ref={scoreRef}>0</span></div>
              <div>Rekord: <span ref={hiscoreRef}>0</span></div>
            </div>
            <div className="uxv-screen">
              <canvas ref={canvasRef} width={1008} height={576} aria-label="Snake – Nokia style"></canvas>
              <div className="uxv-scanlines" />
              <div className="uxv-overlay" ref={overlayRef}>
                <div className="panel">
                  <h1>SNAKE – Nokia style</h1>
                  <p>Strzałki / WASD – sterowanie</p>
                  <p>[Spacja] – start/pauza  •  [R] – reset</p>
                  <p>Dotyk: użyj krzyżaka poniżej</p>
                </div>
              </div>
            </div>
            <div className="uxv-btns">
              <button className="uxv-btn" ref={startBtnRef}>▶ Start / Pauza</button>
              <button className="uxv-btn" ref={resetBtnRef}>↺ Reset</button>
            </div>
            <div className="uxv-dpad" ref={dpadRef} aria-label="Krzyżak dotykowy">
              <div className="empty"></div>
              <div className="p" data-dir="up">▲</div>
              <div className="empty"></div>
              <div className="p" data-dir="left">◀</div>
              <div className="p" data-dir="center" style={{opacity:.4}}>●</div>
              <div className="p" data-dir="right">▶</div>
              <div className="empty"></div>
              <div className="p" data-dir="down">▼</div>
              <div className="empty"></div>
            </div>
            <div className="uxv-hint">Klasyczne ściany: włączenie kolizji. Tempo rośnie co 5 punktów.</div>
          </div>
        </div>
      </div>
    </LightModal>
  );
}
