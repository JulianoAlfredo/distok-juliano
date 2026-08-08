import { Loading, EmptyState } from '../../../components/ui';
import { IconWallet, IconArrowDown, IconSearch } from '../../../components/ui/icons';
import { formatBRL } from '../../../lib/format';
import { useExpandedRows } from '../../../hooks/useExpandedRows';
import { useDrilldown } from '../useDrilldown';
import { DrilldownModal } from './DrilldownModal';
import { FinancialFilters, FinancialItem, FinancialSummary, FinancialType } from '../types';

const SITUATIONS: { value: FinancialFilters['situation']; label: string }[] = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'upcoming', label: 'A vencer' },
  { value: 'paid', label: 'Pagos' },
  { value: 'all', label: 'Todos' },
];

function SituationBadge({ situation }: { situation: FinancialItem['situation'] }) {
  if (situation === 'overdue') return <span className="badge badge-danger">Vencido</span>;
  if (situation === 'upcoming') return <span className="badge badge-warning">A vencer</span>;
  if (situation === 'paid') return <span className="badge badge-success">Pago</span>;
  return <span className="badge badge-neutral">Cancelado</span>;
}

export function FinancialModal({ open, onClose, type }: { open: boolean; onClose: () => void; type: FinancialType }) {
  const { data, filters, setFilter, page, setPage, loading, error } = useDrilldown<FinancialItem, FinancialFilters, FinancialSummary>(
    '/dashboard/drilldown/financial',
    { type, situation: 'pending', search: '', dateFrom: '', dateTo: '', includeCancelled: false },
  );
  const { isExpanded, toggle } = useExpandedRows();

  const title = type === 'receivable' ? 'Contas a receber' : 'Contas a pagar';
  const icon = type === 'receivable' ? <IconWallet /> : <IconArrowDown />;
  const s = data.summary;
  const summaryText = s
    ? `Total: ${formatBRL(s.totalAmount)} (${s.count})${s.overdueCount > 0 ? ` · Vencido: ${formatBRL(s.overdueAmount)} (${s.overdueCount})` : ''}`
    : undefined;

  return (
    <DrilldownModal
      open={open}
      onClose={onClose}
      title={title}
      itemLabel="lançamento"
      page={page}
      pages={data.pages}
      total={data.total}
      onPageChange={setPage}
      summary={summaryText}
      filters={
        <>
          <div style={{ position: 'relative', minWidth: 200, flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={16} height={16} /></span>
            <input
              className="input" style={{ paddingLeft: 34 }}
              aria-label="Buscar por descrição ou nome" placeholder="Buscar descrição, cliente ou fornecedor"
              value={filters.search} onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <select className="input" style={{ maxWidth: 160 }} aria-label="Filtrar por situação"
            value={filters.situation} onChange={(e) => setFilter('situation', e.target.value as FinancialFilters['situation'])}>
            {SITUATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <input type="date" className="input" style={{ maxWidth: 155 }} aria-label="Vencimento de" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} />
          <input type="date" className="input" style={{ maxWidth: 155 }} aria-label="Vencimento até" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} />
          <label className="row" style={{ gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.includeCancelled} onChange={(e) => setFilter('includeCancelled', e.target.checked)} />
            Incluir cancelados
          </label>
        </>
      }
    >
      {loading ? <Loading label="Carregando lançamentos…" /> : error ? (
        <EmptyState icon={icon} title="Não foi possível carregar" hint="Tente novamente em instantes." />
      ) : data.items.length === 0 ? (
        <EmptyState icon={icon} title="Nenhum lançamento encontrado" hint="Ajuste a busca ou os filtros." />
      ) : (
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table className="table">
            <thead><tr><th>{type === 'receivable' ? 'Cliente' : 'Fornecedor'}</th><th>Valor</th><th>Situação</th><th>Descrição</th><th>Vencimento</th><th></th></tr></thead>
            <tbody>
              {data.items.map((f) => (
                <tr key={f.id} className={isExpanded(f.id) ? 'tr-expanded' : ''}>
                  <td data-label={type === 'receivable' ? 'Cliente' : 'Fornecedor'}>
                    {f.party_name || f.customer_name || f.supplier_name || '—'}
                  </td>
                  <td style={{ fontWeight: 600 }} data-label="Valor">{formatBRL(f.amount)}</td>
                  <td data-label="Situação"><SituationBadge situation={f.situation} /></td>
                  <td className="muted td-secondary td-stack" data-label="Descrição">{f.description}</td>
                  <td className="td-secondary" data-label="Vencimento">
                    {new Date(f.due_date).toLocaleDateString('pt-BR')}
                    {f.is_overdue && f.days_overdue > 0 && <span className="muted"> ({f.days_overdue}d)</span>}
                  </td>
                  <td className="tr-expand-toggle">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle(f.id)}>
                      {isExpanded(f.id) ? 'Ver menos' : 'Ver mais'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DrilldownModal>
  );
}
