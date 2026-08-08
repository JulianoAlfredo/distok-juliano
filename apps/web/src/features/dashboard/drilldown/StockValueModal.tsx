import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Loading, EmptyState } from '../../../components/ui';
import { IconLayers, IconSearch, IconArrowUp, IconArrowDown } from '../../../components/ui/icons';
import { formatBRL } from '../../../lib/format';
import { useExpandedRows } from '../../../hooks/useExpandedRows';
import { useDrilldown } from '../useDrilldown';
import { DrilldownModal } from './DrilldownModal';
import { StockValueFilters, StockValueItem, StockValueSummary } from '../types';

interface CatalogItem { id: string; name: string }

const SORT_OPTIONS: { value: StockValueFilters['sort']; label: string }[] = [
  { value: 'value', label: 'Valor' },
  { value: 'name', label: 'Nome' },
  { value: 'qty', label: 'Quantidade' },
];

export function StockValueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, filters, setFilter, page, setPage, loading, error } = useDrilldown<StockValueItem, StockValueFilters, StockValueSummary>(
    '/dashboard/drilldown/stock-value',
    { search: '', category: '', sort: 'value', dir: 'desc' },
  );
  const { isExpanded, toggle } = useExpandedRows();
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  useEffect(() => { api.get('/catalog/categories').then(({ data }) => setCategories(data)).catch(() => {}); }, []);

  return (
    <DrilldownModal
      open={open}
      onClose={onClose}
      title="Valor em estoque"
      itemLabel="produto"
      page={page}
      pages={data.pages}
      total={data.total}
      onPageChange={setPage}
      summary={data.summary ? `Valor total: ${formatBRL(data.summary.totalValue)}` : undefined}
      filters={
        <>
          <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={16} height={16} /></span>
            <input
              className="input" style={{ paddingLeft: 34 }}
              aria-label="Buscar produto" placeholder="Buscar pelo nome ou código"
              value={filters.search} onChange={(e) => setFilter('search', e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <select className="input" style={{ maxWidth: 200 }} aria-label="Filtrar por categoria"
              value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          )}
          <select className="input" style={{ maxWidth: 150 }} aria-label="Ordenar por"
            value={filters.sort} onChange={(e) => setFilter('sort', e.target.value as StockValueFilters['sort'])}>
            {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Ordenar: {o.label}</option>)}
          </select>
          <button
            className="btn btn-sm" aria-label={filters.dir === 'desc' ? 'Ordem decrescente' : 'Ordem crescente'}
            onClick={() => setFilter('dir', filters.dir === 'desc' ? 'asc' : 'desc')}
          >
            {filters.dir === 'desc' ? <IconArrowDown width={14} height={14} /> : <IconArrowUp width={14} height={14} />}
          </button>
        </>
      }
    >
      {loading ? <Loading label="Carregando produtos…" /> : error ? (
        <EmptyState icon={<IconLayers />} title="Não foi possível carregar" hint="Tente novamente em instantes." />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<IconLayers />} title="Nenhum produto encontrado" hint="Ajuste a busca ou o filtro de categoria." />
      ) : (
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table className="table">
            <thead><tr><th>Produto</th><th>Valor total</th><th>Código</th><th>Categoria</th><th>Estoque</th><th>Custo unit.</th><th></th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className={isExpanded(p.id) ? 'tr-expanded' : ''}>
                  <td style={{ fontWeight: 600 }} data-label="Produto">{p.name}</td>
                  <td style={{ fontWeight: 600 }} data-label="Valor total">{formatBRL(p.total_value)}</td>
                  <td className="muted td-secondary" data-label="Código">{p.sku || '—'}</td>
                  <td className="muted td-secondary" data-label="Categoria">{p.category || '—'}</td>
                  <td className="td-secondary" data-label="Estoque">{p.current_stock}</td>
                  <td className="muted td-secondary" data-label="Custo unit.">{formatBRL(p.cost_price)}</td>
                  <td className="tr-expand-toggle">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle(p.id)}>
                      {isExpanded(p.id) ? 'Ver menos' : 'Ver mais'}
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
