import { createContext, useCallback, useContext, useState, ReactNode } from 'react';
import { IconCheck, IconAlert } from './icons';

type Toast = { id: number; text: string; kind: 'success' | 'error' | 'info' };
type ToastCtx = { push: (text: string, kind?: Toast['kind']) => void };

const Ctx = createContext<ToastCtx | null>(null);
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = seq++;
    setItems((s) => [...s, { id, text, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3600);
  }, []);

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind === 'info' ? 'success' : t.kind}`}>
            {t.kind === 'error' ? <IconAlert width={16} height={16} /> : <IconCheck width={16} height={16} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  // fallback silencioso se usado fora do provider (evita crash)
  return ctx ?? { push: () => {} };
}
