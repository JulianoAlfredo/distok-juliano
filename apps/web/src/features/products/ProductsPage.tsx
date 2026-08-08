import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { HistoryModal, HistoryEntry } from '../../components/ui/HistoryModal';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { FieldLabel, FieldError } from '../../components/ui/Hint';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { useExpandedRows } from '../../hooks/useExpandedRows';
import { formatBRL } from '../../lib/format';
import { IconBox, IconPlus, IconSearch, IconHistory, IconDots } from '../../components/ui/icons';

type CatalogItem = { id: string; name: string; symbol?: string };
type Product = {
  id: string; name: string; sku: string | null; category: string | null; unit: string;
  cost_price: number; sale_price: number; min_stock: number; status: string; margin: number | null;
  ze_delivery_item_id: string | null; ze_delivery_sync_enabled: boolean | number;
};
type Page = { items: Product[]; total: number; page: number; pages: number };
const EMPTY = { name: '', sku: '', category: '', unit: 'un', cost_price: 0, sale_price: 0, min_stock: 0, ze_delivery_item_id: '', ze_delivery_sync_enabled: false };
const ACTION_LABEL: Record<string, string> = { 'product.create': 'Cadastro', 'product.update': 'Edição', 'product.inactivate': 'Inativação' };

/** Ações da linha num menu "⋮" — menos botões brigando por espaço, principalmente no cartão mobile.
 *  O menu é renderizado num portal (como o Modal) pra não ser cortado pelo overflow do .table-wrap. */
function RowActionsMenu({ product, onEdit, onInactivate, onActivate, onHistory }: {
  product: Product; onEdit: () => void; onInactivate: () => void; onActivate: () => void; onHistory: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function place() {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos({ top: r.bottom + 4, left: Math.max(8, r.right - 170) });
    }
    place();
    function onClick(e: MouseEvent) {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', onClick);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <>
      <button ref={btnRef} className="btn btn-sm btn-ghost" aria-label={`Mais ações — ${product.name}`} onClick={() => setOpen((v) => !v)}>
        <IconDots width={16} height={16} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="row-actions-menu" role="menu" style={{ position: 'fixed', top: pos.top, left: pos.left }}>
          <button className="user-menu-item" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}>Editar</button>
          {product.status === 'active' ? (
            <button className="user-menu-item" role="menuitem" onClick={() => { setOpen(false); onInactivate(); }}>Inativar</button>
          ) : (
            <button className="user-menu-item" role="menuitem" onClick={() => { setOpen(false); onActivate(); }}>Ativar</button>
          )}
          <button className="user-menu-item" role="menuitem" onClick={() => { setOpen(false); onHistory(); }}>
            <IconHistory width={15} height={15} /> Histórico
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

export function ProductsPage() {
  const { t } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();
  const { errors: fe, validate: validateF, clearAll: clearFE } = useFieldErrors();
  const [page, setPage]           = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch]       = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState<any>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [units, setUnits]           = useState<CatalogItem[]>([]);
  const [history, setHistory]       = useState<{ product: { id: string; name: string }; entries: HistoryEntry[] } | null>(null);
  const { isExpanded, toggle } = useExpandedRows();
  const term = t('product').toLowerCase();

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/products', { params: { search: search || undefined, page: p } });
      setPage(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);
  useEffect(() => {
    api.get('/catalog/categories').then(({ data }) => setCategories(data)).catch(() => {});
    api.get('/catalog/units').then(({ data }) => setUnits(data)).catch(() => {});
    if ((location.state as any)?.autoOpen === 'new') openNew();
    /* eslint-disable-next-line */
  }, []);

  function openNew() { setForm({ ...EMPTY }); setEditingId(null); clearFE(); setOpen(true); }
  function startEdit(p: Product) {
    setForm({
      name: p.name, sku: p.sku || '', category: p.category || '', unit: p.unit, cost_price: p.cost_price, sale_price: p.sale_price, min_stock: p.min_stock,
      ze_delivery_item_id: p.ze_delivery_item_id || '', ze_delivery_sync_enabled: !!p.ze_delivery_sync_enabled,
    });
    setEditingId(p.id); clearFE(); setOpen(true);
  }

  const margin = form && Number(form.cost_price) > 0
    ? Math.round(((Number(form.sale_price) - Number(form.cost_price)) / Number(form.cost_price)) * 10000) / 100
    : null;

  async function save() {
    const nameOk = validateF('name', form.name, { required: true, maxLength: 200 });
    const priceOk = validateF('sale_price', String(form.sale_price), {
      custom: (v) => Number(v) < 0 ? 'Preço não pode ser negativo' : null,
    });
    if (!nameOk || !priceOk) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price), sale_price: Number(form.sale_price), min_stock: Number(form.min_stock),
        ze_delivery_item_id: form.ze_delivery_item_id || null,
        ze_delivery_sync_enabled: !!form.ze_delivery_sync_enabled,
      };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else           await api.post('/products', payload);
      clearFE();
      setOpen(false);
      toast.push(editingId ? 'Item atualizado.' : 'Item cadastrado.', 'success');
      if (editingId) await load();
      else { setCurrentPage(1); await load(1); }
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível salvar.', 'error');
    } finally { setSaving(false); }
  }

  async function inactivate(p: Product) {
    const ok = await confirm({ title: `Inativar "${p.name}"?`, message: 'O item deixa de aparecer nas listas, mas todo o histórico é mantido.', confirmText: 'Sim, inativar', danger: true });
    if (!ok) return;
    await api.patch(`/products/${p.id}/inactivate`);
    toast.push('Item inativado.', 'success');
    await load();
  }

  async function activate(p: Product) {
    await api.patch(`/products/${p.id}/activate`);
    toast.push('Item ativado.', 'success');
    await load();
  }

  async function openHistory(p: Product) {
    const { data } = await api.get(`/products/${p.id}/history`);
    setHistory(data);
  }

  return (
    <div>
      <PageHeader
        title={`${t('product')}s`}
        subtitle="Cadastre seus itens e defina preço de custo e de venda"
        actions={<button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo {term}</button>}
      />

      <div className="row" style={{ marginBottom: 'var(--sp-5)', maxWidth: 440 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} aria-label="Buscar produtos" placeholder="Buscar pelo nome ou código" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); load(1); } }} />
        </div>
        <button className="btn" onClick={() => { setCurrentPage(1); load(1); }}>Buscar</button>
      </div>

      {loading ? <Loading /> : page.items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconBox />} title={`Nenhum ${term} cadastrado`} hint='Clique em "Novo" para cadastrar seu primeiro item.'
            action={<button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo {term}</button>}
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th>Produto</th><th>Preço</th><th>Código</th><th>Categoria</th><th>Zé Delivery</th><th></th><th></th></tr></thead>
            <tbody>
              {page.items.map((p) => (
                <tr key={p.id} className={isExpanded(p.id) ? 'tr-expanded' : ''}>
                  <td className="product-cell-td">
                    <div className="product-cell">
                      <span style={{ fontWeight: 600 }}>{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </td>
                  <td data-label="Preço">
                    {formatBRL(Number(p.cost_price))} → {formatBRL(Number(p.sale_price))}
                    {p.margin != null && <span className="muted"> ({p.margin}%)</span>}
                  </td>
                  <td className="muted td-secondary" data-label="Código">{p.sku || '—'}</td>
                  <td className="muted td-secondary" data-label="Categoria">{p.category || '—'}</td>
                  <td className="td-secondary" data-label="Zé Delivery">
                    {p.ze_delivery_sync_enabled ? <span className="badge badge-success">sync</span> : p.ze_delivery_item_id ? <span className="badge">vinculado</span> : '—'}
                  </td>
                  <td className="tr-expand-toggle">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggle(p.id)}>
                      {isExpanded(p.id) ? 'Ver menos' : 'Ver mais'}
                    </button>
                  </td>
                  <td>
                    <RowActionsMenu
                      product={p}
                      onEdit={() => startEdit(p)}
                      onInactivate={() => inactivate(p)}
                      onActivate={() => activate(p)}
                      onHistory={() => openHistory(p)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{page.total} {term}{page.total !== 1 ? 's' : ''} — página {currentPage} de {page.pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}     onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= page.pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
          </div>
        </>
      )}

      <Modal
        open={open} onClose={() => setOpen(false)}
        title={editingId ? `Editar ${term}` : `Novo ${term}`}
        size="lg"
        footer={
          <>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn" onClick={() => setOpen(false)}>Cancelar</button>
            {margin != null && (
              <span className="muted modal-foot-margin">
                Lucro por item: <strong style={{ color: margin >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{margin}%</strong>
              </span>
            )}
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel required>Nome do {term}</FieldLabel>
            <input
              className={`input${fe.name ? ' error' : ''}`}
              placeholder="Ex.: Refrigerante 2L" value={form.name} autoFocus
              onChange={(e) => { setForm({ ...form, name: e.target.value }); if (fe.name) validateF('name', e.target.value, { required: true }); }}
            />
            <FieldError>{fe.name}</FieldError>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Código interno para localizar o item rapidamente. Pode deixar em branco.">Código (SKU)</FieldLabel>
            <input className="input" placeholder="opcional" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Agrupa itens parecidos (ex.: Bebidas, Limpeza). Opcional.">Categoria</FieldLabel>
            {categories.length > 0 ? (
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Sem categoria</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="Ex.: Bebidas" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            )}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Como você conta o item: unidade (un), caixa (cx), kg...">Unidade</FieldLabel>
            {units.length > 0 ? (
              <select className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {units.map((u) => <option key={u.id} value={u.symbol}>{u.name} ({u.symbol})</option>)}
              </select>
            ) : (
              <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            )}
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Quanto você paga por este item.">Preço de custo</FieldLabel>
            <MoneyInput value={Number(form.cost_price)} onChange={(v) => setForm({ ...form, cost_price: v })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Por quanto você revende este item.">Preço de venda</FieldLabel>
            <MoneyInput value={Number(form.sale_price)} onChange={(v) => setForm({ ...form, sale_price: v })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="O sistema avisa quando o saldo ficar igual ou abaixo deste número.">Estoque mínimo</FieldLabel>
            <input className="input" type="number" min={0} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="ID do item correspondente no catálogo do Zé Delivery. Deixe em branco se este item não existe lá.">Item no Zé Delivery</FieldLabel>
            <input className="input" placeholder="opcional" value={form.ze_delivery_item_id}
              onChange={(e) => setForm({ ...form, ze_delivery_item_id: e.target.value, ze_delivery_sync_enabled: e.target.value ? form.ze_delivery_sync_enabled : false })} />
          </div>
          <div className="field" style={{ margin: 0, display: 'flex', alignItems: 'flex-end' }}>
            <label className="row" style={{ gap: 'var(--sp-2)', alignItems: 'center', cursor: form.ze_delivery_item_id ? 'pointer' : 'not-allowed' }}>
              <input type="checkbox" disabled={!form.ze_delivery_item_id} checked={!!form.ze_delivery_sync_enabled}
                onChange={(e) => setForm({ ...form, ze_delivery_sync_enabled: e.target.checked })} />
              Sincronizar estoque com o Zé Delivery
            </label>
          </div>
        </div>
      </Modal>

      <HistoryModal
        open={!!history}
        onClose={() => setHistory(null)}
        title={history ? `${history.product.name} — Histórico` : ''}
        entries={history?.entries || []}
        actionLabels={ACTION_LABEL}
      />
    </div>
  );
}
