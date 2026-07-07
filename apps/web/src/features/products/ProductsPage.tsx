import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { FieldLabel, FieldError } from '../../components/ui/Hint';
import { BulkActionsBar } from '../../components/ui/BulkActionsBar';
import { useFieldErrors } from '../../hooks/useFieldErrors';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { formatBRL } from '../../lib/format';
import { IconBox, IconPlus, IconSearch } from '../../components/ui/icons';

type CatalogItem = { id: string; name: string; symbol?: string };
type Product = { id: string; name: string; sku: string | null; category: string | null; unit: string; cost_price: number; sale_price: number; min_stock: number; status: string; margin: number | null };
const EMPTY = { name: '', sku: '', category: '', unit: 'un', cost_price: 0, sale_price: 0, min_stock: 0 };

export function ProductsPage() {
  const { t } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();
  const { errors: fe, validate: validateF, clearAll: clearFE } = useFieldErrors();
  const [items, setItems]         = useState<Product[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [open, setOpen]           = useState(false);
  const [form, setForm]           = useState<any>({ ...EMPTY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [units, setUnits]           = useState<CatalogItem[]>([]);
  const term = t('product').toLowerCase();
  const bulk = useBulkSelection(items);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/products', { params: { search: search || undefined } });
    setItems(data);
    setLoading(false);
  }
  useEffect(() => {
    load();
    api.get('/catalog/categories').then(({ data }) => setCategories(data)).catch(() => {});
    api.get('/catalog/units').then(({ data }) => setUnits(data)).catch(() => {});
    if ((location.state as any)?.autoOpen === 'new') openNew();
    /* eslint-disable-next-line */
  }, []);

  function openNew() { setForm({ ...EMPTY }); setEditingId(null); clearFE(); setOpen(true); }
  function startEdit(p: Product) {
    setForm({ name: p.name, sku: p.sku || '', category: p.category || '', unit: p.unit, cost_price: p.cost_price, sale_price: p.sale_price, min_stock: p.min_stock });
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
      const payload = { ...form, cost_price: Number(form.cost_price), sale_price: Number(form.sale_price), min_stock: Number(form.min_stock) };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else           await api.post('/products', payload);
      clearFE();
      setOpen(false);
      toast.push(editingId ? 'Item atualizado.' : 'Item cadastrado.', 'success');
      await load();
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

  async function bulkInactivate() {
    const targets = items.filter((p) => bulk.isSelected(p.id) && p.status === 'active');
    if (targets.length === 0) { bulk.clear(); return; }
    const ok = await confirm({ title: `Inativar ${targets.length} ${term}(s)?`, message: 'Os itens deixam de aparecer nas listas, mas todo o histórico é mantido.', confirmText: 'Sim, inativar', danger: true });
    if (!ok) return;
    await Promise.all(targets.map((p) => api.patch(`/products/${p.id}/inactivate`)));
    toast.push(`${targets.length} ${term}(s) inativado(s).`, 'success');
    bulk.clear();
    await load();
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
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn" onClick={load}>Buscar</button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconBox />} title={`Nenhum ${term} cadastrado`} hint='Clique em "Novo" para cadastrar seu primeiro item.'
            action={<button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo {term}</button>}
          />
        </div>
      ) : (
        <>
          <BulkActionsBar count={bulk.count} onClear={bulk.clear}>
            <button className="btn btn-sm" onClick={bulkInactivate}>Inativar selecionados</button>
          </BulkActionsBar>
          <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th className="bulk-col"><input type="checkbox" aria-label="Selecionar todos" checked={bulk.allSelected} onChange={bulk.toggleAll} /></th>
              <th>Nome</th><th>Código</th><th>Categoria</th><th>Custo</th><th>Venda</th><th>Lucro</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td className="bulk-col"><input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={bulk.isSelected(p.id)} onChange={() => bulk.toggle(p.id)} /></td>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="muted">{p.sku || '—'}</td>
                  <td className="muted">{p.category || '—'}</td>
                  <td>{formatBRL(Number(p.cost_price))}</td>
                  <td>{formatBRL(Number(p.sale_price))}</td>
                  <td>{p.margin == null ? '—' : `${p.margin}%`}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 'var(--sp-2)' }}>
                      <button className="btn btn-sm" onClick={() => startEdit(p)}>Editar</button>
                      {p.status === 'active' && <button className="btn btn-sm" onClick={() => inactivate(p)}>Inativar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 'var(--fs-sm)' }}>
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
        </div>
      </Modal>
    </div>
  );
}
