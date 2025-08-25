import React from 'react'

const ModalContext = React.createContext(null);

export function ModalProvider({ children }){
  const [state, setState] = React.useState({ open:false });
  const resolverRef = React.useRef(null);
  const inputRef = React.useRef(null);

  const close = (result) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setState({ open:false });
    if (resolver) resolver(result);
  };

  const open = (cfg) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({ open:true, ...cfg });
      setTimeout(() => {
        if (cfg.type === 'prompt' && inputRef.current) inputRef.current.focus();
      }, 0);
    });
  };

  const api = {
    alert: ({ title='Info', message='', status='info' }={}) => open({ type:'alert', title, message, status }),
    confirm: ({ title='Potwierdź', message='' }={}) => open({ type:'confirm', title, message }),
    prompt: ({ title='Wpisz', label='Nazwa', initialValue='', multiline=false, readOnly=false }={}) => open({ type:'prompt', title, label, initialValue, multiline, readOnly }),
    copy: ({ title='Skopiuj', value='' }={}) => open({ type:'copy', title, value })
  };

  React.useEffect(() => {
    const onEsc = (e) => { if (e.key === 'Escape' && state.open) close(null); };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [state.open]);

  const onBackdrop = (e) => { if (e.target === e.currentTarget) close(null); };

  return (
    <ModalContext.Provider value={api}>
      {children}
      {state.open && (
        <div className="modalBackdrop" onMouseDown={onBackdrop}>
          <div className="modalCard" role="dialog" aria-modal="true">
            <div className="modalHeader">
              <div className="modalTitle">{state.title}</div>
              <button className="modalClose" onClick={() => close(null)}>×</button>
            </div>
            <div className="modalBody">
              {state.message && <div className="modalMsg">{state.message}</div>}
              {state.type === 'prompt' && (
                <div className="modalField">
                  <label className="modalLabel">{state.label}</label>
                  {state.multiline ? (
                    <textarea ref={inputRef} defaultValue={state.initialValue} readOnly={!!state.readOnly} rows={4}></textarea>
                  ) : (
                    <input ref={inputRef} type="text" defaultValue={state.initialValue} readOnly={!!state.readOnly} />
                  )}
                </div>
              )}
              {state.type === 'copy' && (
                <div className="modalField">
                  <textarea ref={inputRef} defaultValue={state.value} readOnly rows={6}></textarea>
                </div>
              )}
            </div>
            <div className="modalActions">
              {state.type === 'alert' && <button className="btnPrimary" onClick={() => close(true)}>OK</button>}
              {state.type === 'confirm' && (<>
                <button onClick={() => close(false)}>Anuluj</button>
                <button className="btnPrimary" onClick={() => close(true)}>OK</button>
              </>)}
              {state.type === 'prompt' && (<>
                <button onClick={() => close(null)}>Anuluj</button>
                <button className="btnPrimary" onClick={() => {
                  const el = inputRef.current;
                  close(el ? el.value : '');
                }}>OK</button>
              </>)}
              {state.type === 'copy' && (<>
                <button onClick={() => {
                  const el = inputRef.current;
                  if (el) { el.select(); document.execCommand('copy'); }
                }}>Kopiuj</button>
                <button className="btnPrimary" onClick={() => close(true)}>Zamknij</button>
              </>)}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}


function fallbackOverlay({ type='alert', title='Info', message='', label='Wpisz', initialValue='', value='', multiline=false, readOnly=false }){
  // Create minimal overlay
  const overlay = document.createElement('div');
  overlay.className = 'modalBackdrop';
  overlay.style.zIndex = '9999'; // ensure on top
  const card = document.createElement('div');
  card.className = 'modalCard';
  const header = document.createElement('div');
  header.className = 'modalHeader';
  const h = document.createElement('div');
  h.className = 'modalTitle';
  h.textContent = title || 'Info';
  const x = document.createElement('button');
  x.className = 'modalClose';
  x.textContent = '×';
  header.appendChild(h);
  header.appendChild(x);
  const body = document.createElement('div');
  body.className = 'modalBody';
  if (message) { const m=document.createElement('div'); m.className='modalMsg'; m.textContent=message; body.appendChild(m); }
  let inputEl = null;
  if (type==='prompt'){
    const fld = document.createElement('div');
    fld.className='modalField';
    const lab = document.createElement('label');
    lab.className='modalLabel';
    lab.textContent = label || 'Wpisz';
    fld.appendChild(lab);
    if (multiline){
      inputEl = document.createElement('textarea');
      inputEl.rows = 4;
    } else {
      inputEl = document.createElement('input');
      inputEl.type = 'text';
    }
    inputEl.value = initialValue || '';
    if (readOnly) inputEl.readOnly = true;
    fld.appendChild(inputEl);
    body.appendChild(fld);
  } else if (type==='copy'){
    const fld = document.createElement('div');
    fld.className='modalField';
    inputEl = document.createElement('textarea');
    inputEl.rows = 6;
    inputEl.value = value || '';
    inputEl.readOnly = true;
    fld.appendChild(inputEl);
    body.appendChild(fld);
  }
  const actions = document.createElement('div');
  actions.className = 'modalActions';

  return new Promise((resolve) => {
    function close(result){
      overlay.remove();
      resolve(result);
    }
    if (type==='alert'){
      const ok = document.createElement('button');
      ok.className='btnPrimary';
      ok.textContent='OK';
      ok.addEventListener('click', () => close(true));
      actions.appendChild(ok);
    } else if (type==='confirm'){
      const cancel = document.createElement('button'); cancel.textContent='Anuluj';
      const ok = document.createElement('button'); ok.className='btnPrimary'; ok.textContent='OK';
      cancel.addEventListener('click', () => close(false));
      ok.addEventListener('click', () => close(true));
      actions.appendChild(cancel); actions.appendChild(ok);
    } else if (type==='prompt'){
      const cancel = document.createElement('button'); cancel.textContent='Anuluj';
      const ok = document.createElement('button'); ok.className='btnPrimary'; ok.textContent='OK';
      cancel.addEventListener('click', () => close(null));
      ok.addEventListener('click', () => close(inputEl ? inputEl.value : ''));
      actions.appendChild(cancel); actions.appendChild(ok);
      setTimeout(() => { inputEl && inputEl.focus(); }, 0);
    } else if (type==='copy'){
      const copy = document.createElement('button'); copy.textContent='Kopiuj';
      const ok = document.createElement('button'); ok.className='btnPrimary'; ok.textContent='Zamknij';
      copy.addEventListener('click', () => { try{ inputEl.select(); document.execCommand('copy'); }catch{} });
      ok.addEventListener('click', () => close(true));
      actions.appendChild(copy); actions.appendChild(ok);
      setTimeout(() => { inputEl && inputEl.select(); }, 0);
    }
    x.addEventListener('click', () => close(null));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(actions);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

export function useModal(){
  const ctx = React.useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function useModalSafe(){
  // If provider is missing, return native fallbacks so the app still works.
  try{
    const ctx = React.useContext(ModalContext);
    if (ctx) return ctx;
  }catch{}
  return {
    alert: async ({ title='Info', message='' }={}) => await fallbackOverlay({ type:'alert', title, message }),
    confirm: async ({ title='Potwierdź', message='' }={}) => await fallbackOverlay({ type:'confirm', title, message }),
    prompt: async ({ title='Wpisz', label='Nazwa', initialValue='', multiline=false, readOnly=false }={}) => await fallbackOverlay({ type:'prompt', title, label, initialValue, multiline, readOnly }),
    copy: async ({ title='Skopiuj', value='' }={}) => await fallbackOverlay({ type:'copy', title, value })
  };
}
