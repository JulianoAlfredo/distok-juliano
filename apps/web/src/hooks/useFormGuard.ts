import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Detecta se um formulário tem mudanças não salvas.
 * Quando dirty=true e o usuário tenta fechar, exibe confirm() nativo.
 */
export function useFormGuard(active = true) {
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  // Previne navegação/refresh do browser quando dirty
  useEffect(() => {
    if (!active || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active, dirty]);

  /** Chama antes de fechar o modal. Retorna true se pode fechar. */
  const guardClose = useCallback((onClose: () => void) => {
    if (!dirtyRef.current) { onClose(); return; }
    // eslint-disable-next-line no-alert
    if (window.confirm('Você tem alterações não salvas. Deseja descartar?')) {
      setDirty(false);
      onClose();
    }
  }, []);

  /** Marca como dirty (chame em onChange dos campos) */
  const markDirty = useCallback(() => setDirty(true), []);

  /** Limpa ao salvar com sucesso */
  const markClean = useCallback(() => setDirty(false), []);

  return { dirty, markDirty, markClean, guardClose };
}
