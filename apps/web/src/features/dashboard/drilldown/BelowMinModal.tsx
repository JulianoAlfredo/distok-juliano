import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Loading, EmptyState } from '../../../components/ui';
import { IconAlertTriangle, IconSearch } from '../../../components/ui/icons';
import { useExpandedRows } from '../../../hooks/useExpandedRows';
import { useDrilldown } from '../useDrilldown';
import { DrilldownModal } from './DrilldownModal';
import { BelowMinFilters, BelowMinItem } from '../types';

interface CatalogItem { id: string; name: string }

export function BelowMinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, filters, setFilter, page, setPage, loading, error } = useDrilldown<BelowMinItem, BelowMinFilters>(
    '/dashboard/drilldown/below-min',
    { search: '', category: '' },
  );
  const { isExpanded, toggle } = useExpandedRows();
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  useEffect(() => { api.get('/catalog/categories').then(({ data }) => setCategories(data)).catch(() => {}); }, []);

  return (
    <DrilldownModal
      open={open}
      onClose={onClose}
      title="Produtos abaixo do mínimo"
      subtitle="Itens com saldo igual ou menor que o estoque mínimo definido"
      itemLabel="produto"
      page={page}
      pages={data.pages}
      total={data.total}
      onPageChange={setPage}
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
        </>
      }
    >
      {loading ? <Loading label="Carregando produtos…" /> : error ? (
        <EmptyState icon={<IconAlertTriangle />} title="Não foi possível carregar" hint="Tente novamente em instantes." />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<IconAlertTriangle />} title="Nenhum produto encontrado" hint="Ajuste a busca ou o filtro de categoria." />
      ) : (
        <div className="table-wrap" style={{ boxShadow: 'none' }}>
          <table className="table">
            <thead><tr><th>Produto</th><th>Faltam</th><th>Código</th><th>Categoria</th><th>Estoque</th><th>Mínimo</th><th></th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className={isExpanded(p.id) ? 'tr-expanded' : ''}>
                  <td style={{ fontWeight: 600 }} data-label="Produto">{p.name}</td>
                  <td style={{ fontWeight: 600, color: 'var(--color-warning)' }} data-label="Faltam">{p.missing}</td>
                  <td className="muted td-secondary" data-label="Código">{p.sku || '—'}</td>
                  <td className="muted td-secondary" data-label="Categoria">{p.category || '—'}</td>
                  <td className="td-secondary" data-label="Estoque">{p.current_stock}</td>
                  <td className="td-secondary" data-label="Mínimo">{p.min_stock}</td>
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
