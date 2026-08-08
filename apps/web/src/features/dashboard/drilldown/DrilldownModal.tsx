import { ReactNode, useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { IconChevronDown } from '../../../components/ui/icons';

interface DrilldownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Filtros (busca, selects) — renderizados no topo do corpo do modal. */
  filters?: ReactNode;
  /** Tabela (ou Loading/EmptyState) — corpo principal. */
  children: ReactNode;
  page: number;
  pages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Nome do item no singular, ex.: "produto", "venda", "lançamento". */
  itemLabel: string;
  /** Rodapé opcional de soma (ex.: "Total: R$ 1.234,00"). */
  summary?: ReactNode;
  headerAction?: ReactNode;
}

/** Casca compartilhada por todas as modais de drill-down do dashboard.
 *  Reusa o Modal genérico (`components/ui/Modal.tsx`, já portal-based e
 *  bottom-sheet abaixo de 760px) — nunca cria modal novo. */
export function DrilldownModal({
  open, onClose, title, subtitle, filters, children,
  page, pages, total, onPageChange, itemLabel, summary, headerAction,
}: DrilldownModalProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="xl"
      footer={
        <div className="pagination" style={{ padding: 0, border: 'none', width: '100%' }}>
          <span className="pagination-info">
            {total} {itemLabel}{total !== 1 ? 's' : ''} — página {page} de {pages}
            {summary && <> · {summary}</>}
          </span>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>← Anterior</button>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Próxima →</button>
        </div>
      }
    >
      {(filters || headerAction) && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          {filters && (
            <button
              type="button" className="btn btn-sm btn-ghost drilldown-filters-toggle"
              onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}
            >
              Filtros <IconChevronDown width={14} height={14} style={{ transform: filtersOpen ? 'rotate(180deg)' : undefined, transition: 'transform var(--t-fast)' }} />
            </button>
          )}
          <div className="row-between wrap" style={{ gap: 'var(--sp-3)' }}>
            <div className={`row wrap drilldown-filters${filtersOpen ? ' open' : ''}`} style={{ gap: 'var(--sp-3)', flex: 1 }}>{filters}</div>
            {headerAction}
          </div>
        </div>
      )}
      {children}
    </Modal>
  );
}
