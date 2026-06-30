import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { FieldLabel } from '../../components/ui/Hint';
import { formatBRL } from '../../lib/format';
import { IconBox, IconPlus, IconSearch } from '../../components/ui/icons';

type CatalogItem = { id: string; name: string; symbol?: string };

type Product = {
  id: string; name: string; sku: string | null; category: string | null; unit: string;
  cost_price: number; sale_price: number; min_stock: number; status: string; margin: number | null;
};

const EMPTY = { name: '', sku: '', category: '', unit: 'un', cost_price: 0, sale_price: 0, min_stock: 0 };

export function ProductsPage() {
  const { t } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [units, setUnits]           = useState<CatalogItem[]>([]);
  const term = t('product').toLowerCase();

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
    /* eslint-disable-next-line */
  }, []);

  const margin = form && Number(form.cost_price) > 0
    ? Math.round(((Number(form.sale_price) - Number(form.cost_price)) / Number(form.cost_price)) * 10000) / 100
    : null;

  async function save() {
    if (!form.name.trim()) return toast.push('Dê um nome para o item.', 'error');
    setSaving(true);
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), sale_price: Number(form.sale_price), min_stock: Number(form.min_stock) };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post('/products', payload);
      setForm(null); setEditingId(null);
      toast.push(editingId ? 'Item atualizado com sucesso.' : 'Item cadastrado com sucesso.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function inactivate(p: Product) {
    const ok = await confirm({
      title: `Inativar "${p.name}"?`,
      message: 'O item deixa de aparecer nas listas, mas todo o histórico é mantido. Você pode reativar depois.',
      confirmText: 'Sim, inativar', danger: true,
    });
    if (!ok) return;
    await api.patch(`/products/${p.id}/inactivate`);
    toast.push('Item inativado.', 'success');
    await load();
  }

  return (
    <div>
      <PageHeader
        title={`${t('product')}s`}
        subtitle="Cadastre seus itens e defina preço de custo e de venda"
        actions={!form && <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditingId(null); }}><IconPlus width={16} height={16} /> Novo {term}</button>}
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)', maxWidth: 440 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar pelo nome ou código" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn" onClick={load}>Buscar</button>
      </div>

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>{editingId ? 'Editar' : 'Novo'} {term}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)' }}>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required>Nome do {term}</FieldLabel>
              <input className="input" placeholder="Ex.: Refrigerante 2L" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
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
          <p className="muted mt-4">Lucro por item: <strong style={{ color: margin != null && margin >= 0 ? 'var(--color-success)' : 'var(--color-text)' }}>{margin == null ? '—' : `${margin}%`}</strong></p>
          <div className="row mt-2">
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn" onClick={() => { setForm(null); setEditingId(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconBox />} title={`Nenhum ${term} cadastrado`} hint="Clique em “Novo” para cadastrar seu primeiro item." action={!form && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><IconPlus width={16} height={16} /> Novo {term}</button>} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Código</th><th>Custo</th><th>Venda</th><th>Lucro</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="muted">{p.sku || '—'}</td>
                  <td>{formatBRL(Number(p.cost_price))}</td>
                  <td>{formatBRL(Number(p.sale_price))}</td>
                  <td>{p.margin == null ? '—' : `${p.margin}%`}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 'var(--sp-2)' }}>
                      <button className="btn btn-sm" onClick={() => { setForm({ name: p.name, sku: p.sku || '', category: p.category || '', unit: p.unit, cost_price: p.cost_price, sale_price: p.sale_price, min_stock: p.min_stock }); setEditingId(p.id); }}>Editar</button>
                      {p.status === 'active' && <button className="btn btn-sm" onClick={() => inactivate(p)}>Inativar</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
