import { useNavigate } from 'react-router-dom';
import { Loading, EmptyState } from '../../../components/ui';
import { IconTrendUp, IconSearch } from '../../../components/ui/icons';
import { formatBRL } from '../../../lib/format';
import { useExpandedRows } from '../../../hooks/useExpandedRows';
import { useDrilldown } from '../useDrilldown';
import { DrilldownModal } from './DrilldownModal';
import { PAYMENT } from '../constants';
import { SalesFilters, SaleItem, SalesSummary } from '../types';

type SaleRow = SaleItem;

export function SalesModal({ open, onClose, initialPeriod }: { open: boolean; onClose: () => void; initialPeriod: 'today' | 'month' }) {
  const navigate = useNavigate();
  const { data, filters, setFilter, page, setPage, loading, error } = useDrilldown<SaleRow, SalesFilters, SalesSummary>(
    '/dashboard/drilldown/sales',
    { period: initialPeriod, dateFrom: '', dateTo: '', search: '', paymentMethod: '', includeCancelled: false },
  );
  const { isExpanded, toggle } = useExpandedRows();

  function setDateFrom(v: string) {
    setFilter('dateFrom', v);
    setFilter('period', v && filters.dateTo ? 'custom' : 'month');
  }
  function setDateTo(v: string) {
    setFilter('dateTo', v);
    setFilter('period', filters.dateFrom && v ? 'custom' : 'month');
  }
  function clearRange() {
    setFilter('dateFrom', '');
    setFilter('dateTo', '');
    setFilter('period', 'month');
  }

  const title = initialPeriod === 'today' ? 'Vendas de hoje' : 'Vendas do mês';

  return (
    <DrilldownModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={initialPeriod === 'month' ? 'Filtre por um intervalo específico dentro do mês, se precisar' : undefined}
      itemLabel="venda"
      page={page}
      pages={data.pages}
      total={data.total}
      onPageChange={setPage}
      summary={data.summary ? `Total: ${formatBRL(data.summary.totalAmount)}` : undefined}
      headerAction={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/vendas')}>Ver todas as vendas →</button>}
      filters={
        <>
          <div style={{ position: 'relative', minWidth: 200, flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={16} height={16} /></span>
            <input
              className="input" style={{ paddingLeft: 34 }}
              aria-label="Buscar por cliente ou número" placeholder="Buscar cliente ou nº da venda"
              value={filters.search} onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          <select className="input" style={{ maxWidth: 170 }} aria-label="Filtrar por pagamento"
            value={filters.paymentMethod} onChange={(e) => setFilter('paymentMethod', e.target.value)}>
            <option value="">Toda forma de pagamento</option>
            {Object.entries(PAYMENT).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {initialPeriod === 'month' && (
            <>
              <input type="date" className="input" style={{ maxWidth: 155 }} aria-label="De" value={filters.dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" className="input" style={{ maxWidth: 155 }} aria-label="Até" value={filters.dateTo} onChange={(e) => setDateTo(e.target.value)} />
              {(filters.dateFrom || filters.dateTo) && (
                <button className="btn btn-sm btn-ghost" onClick={clearRange}>Limpar intervalo</button>
              )}
            </>
          )}
          <label className="row" style={{ gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
            <input type="checkbox" checked={filters.includeCancelled} onChange={(e) => setFilter('includeCancelled', e.target.checked)} />
            Incluir canceladas
          </label>
        </>
      }
    >
      {loading ? <Loading label="Carregando vendas…" /> : error ? (
        <EmptyState icon={<IconTrendUp />} title="Não foi possível carregar" hint="Tente novamente em instantes." />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<IconTrendUp />} title="Nenhuma venda encontrada" hint="Ajuste a busca ou os filtros." />
      ) : (
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table className="table">
            <thead><tr><th>Cliente</th><th>Total</th><th>Status</th><th>#</th><th>Itens</th><th>Unid.</th><th>Pagamento</th><th>Data</th><th></th></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id} className={isExpanded(s.id) ? 'tr-expanded' : ''}>
                  <td data-label="Cliente">{s.customer_name || <span className="muted">Avulso</span>}</td>
                  <td style={{ fontWeight: 600 }} data-label="Total">{formatBRL(s.total)}</td>
                  <td data-label="Status">
                    {s.status === 'cancelled'
                      ? <span className="badge badge-danger">Cancelada</span>
                      : <span className="badge badge-success">Aberta</span>}
                  </td>
                  <td style={{ fontWeight: 700 }} data-label="#" className="td-secondary">#{s.number}</td>
                  <td data-label="Itens" className="td-secondary">{s.items_count}</td>
                  <td data-label="Unid." className="td-secondary">{s.units_count}</td>
                  <td className="muted td-secondary" data-label="Pagamento">{PAYMENT[s.payment_method] || s.payment_method}</td>
                  <td className="muted td-secondary" data-label="Data">{new Date(s.sold_at).toLocaleString('pt-BR')}</td>
                  <td className="tr-expand-toggle">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle(s.id)}>
                      {isExpanded(s.id) ? 'Ver menos' : 'Ver mais'}
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
