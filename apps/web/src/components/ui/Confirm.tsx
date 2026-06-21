import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

type ConfirmOpts = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;

const Ctx = createContext<ConfirmFn | null>(null);

/** Diálogo de confirmação amigável (substitui window.confirm).
 *  Uso: const confirm = useConfirm(); if (await confirm({...})) { ... } */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = undefined;
    setOpts(null);
  }

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="confirm-backdrop" onClick={() => close(false)}>
          <div className="confirm card" role="alertdialog" aria-modal="true" aria-label={opts.title} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 'var(--sp-2)' }}>{opts.title}</h3>
            {opts.message && <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>{opts.message}</p>}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => close(false)}>{opts.cancelText || 'Cancelar'}</button>
              <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>
                {opts.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(Ctx);
  // fallback: usa window.confirm se o provider não estiver montado
  return ctx ?? (async (o) => window.confirm(o.message || o.title));
}
