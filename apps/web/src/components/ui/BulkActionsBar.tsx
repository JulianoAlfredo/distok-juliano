import { ReactNode } from 'react';
import { IconClose } from './icons';

/** Barra de ações em lote exibida quando há itens selecionados numa tabela. */
export function BulkActionsBar({ count, onClear, children }: { count: number; onClear: () => void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="bulk-bar">
      <span className="bulk-bar-count">{count} selecionado{count !== 1 ? 's' : ''}</span>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>{children}</div>
      <button className="btn btn-sm btn-ghost" onClick={onClear} title="Cancelar seleção" aria-label="Cancelar seleção">
        <IconClose width={15} height={15} />
      </button>
    </div>
  );
}
