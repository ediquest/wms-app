
import React from 'react'
export default function ScrollTabs({ children, height=42 }){
  const ref = React.useRef(null)
  const [canL, setCanL] = React.useState(false)
  const [canR, setCanR] = React.useState(false)
  const [drag, setDrag] = React.useState({ down:false, x:0, left:0 })
  const update = React.useCallback(() => {
    const el = ref.current; if (!el) return
    setCanL(el.scrollLeft > 0)
    setCanR(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])
  React.useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const onResize = () => update()
    const onScroll = () => update()
    window.addEventListener('resize', onResize)
    el.addEventListener('scroll', onScroll)
    return () => { window.removeEventListener('resize', onResize); el.removeEventListener('scroll', onScroll) }
  }, [update])
  const scrollBy = (dx) => { const el = ref.current; if (el) el.scrollBy({ left: dx, behavior: 'smooth' }) }
  const onMouseDown = (e) => { if (ref.current) setDrag({ down:true, x:e.clientX, left: ref.current.scrollLeft }) }
  const onMouseMove = (e) => { if (drag.down && ref.current){ ref.current.scrollLeft = drag.left - (e.clientX - drag.x) } }
  const onMouseUp = () => setDrag(d => ({ ...d, down:false }))
  const onMouseLeave = () => setDrag(d => ({ ...d, down:false }))
  const onWheel = (e) => { if (ref.current){ const delta = e.deltaY || e.deltaX; if (Math.abs(delta)>0){ e.preventDefault(); ref.current.scrollLeft += delta } } }
  return (
    <div className="tabsWrap" style={{position:'relative', display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:6}}>
      <button className="tabsArrow left" onClick={() => scrollBy(-200)} disabled={!canL}>‹</button>
      <div className="tabsScroll" ref={ref} style={{overflow:'hidden', whiteSpace:'nowrap', display:'flex', gap:8, alignItems:'stretch', height}}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onWheel={onWheel}>
        {children}
      </div>
      <button className="tabsArrow right" onClick={() => scrollBy(200)} disabled={!canR}>›</button>
    </div>
  )
}
