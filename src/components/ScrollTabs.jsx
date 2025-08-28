import React from 'react';

export default function ScrollTabs({ children, height = 42 }) {
  const ref = React.useRef(null);
  const [canL, setCanL] = React.useState(false);
  const [canR, setCanR] = React.useState(false);
  const [drag, setDrag] = React.useState({ down: false, x: 0, left: 0 });

  const update = React.useCallback(() => {
    const el = ref.current; if (!el) return;
    setCanL(el.scrollLeft > 0);
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  React.useEffect(() => {
    update();
    const el = ref.current; if (!el) return;
    const onResize = () => update();
    const onScroll = () => update();
    window.addEventListener('resize', onResize);
    el.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('resize', onResize);
      el.removeEventListener('scroll', onScroll);
    };
  }, [update]);

  // ✅ natywny wheel z passive:false + mapowanie Y→X
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const onWheel = (e) => {
      // normalizacja jednostek (pixel/line/page)
      const mode = e.deltaMode || 0; // 0=pixels, 1=lines, 2=pages
      const factor = mode === 1 ? 16 : mode === 2 ? el.clientHeight : 1;
      const dy = (e.deltaY ?? 0) * factor;
      const dx = (e.deltaX ?? 0) * factor;
      const delta = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
      if (delta) {
        e.preventDefault();           // działa, bo passive:false
        el.scrollLeft += delta;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const scrollBy = (dx) => { const el = ref.current; if (el) el.scrollBy({ left: dx, behavior: 'smooth' }); };
  const onMouseDown = (e) => { if (ref.current) setDrag({ down: true, x: e.clientX, left: ref.current.scrollLeft }); };
  const onMouseMove = (e) => { if (drag.down && ref.current) { ref.current.scrollLeft = drag.left - (e.clientX - drag.x); } };
  const onMouseUp = () => setDrag(d => ({ ...d, down: false }));
  const onMouseLeave = () => setDrag(d => ({ ...d, down: false }));

  return (
    <div className="tabsWrap"
      style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 6 }}>
      <button className="tabsArrow left" onClick={() => scrollBy(-200)} disabled={!canL}>‹</button>
      <div
        className="tabsScroll"
        ref={ref}
        style={{
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          display: 'flex',
          gap: 8,
          alignItems: 'stretch',
          height,
          overscrollBehavior: 'contain', // ogranicza „przebijanie” scrolla
          touchAction: 'pan-x'           // na touch pozwól przewijać w poziomie
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </div>
      <button className="tabsArrow right" onClick={() => scrollBy(200)} disabled={!canR}>›</button>
    </div>
  );
}
