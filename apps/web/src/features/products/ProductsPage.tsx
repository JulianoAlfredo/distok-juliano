import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { IconBox, IconPlus, IconSearch } from '../../components/ui/icons';

type Product = {
  id: string; name: string; sku: string | null; category: string | null; unit: string;
  cost_price: number; sale_price: number; min_stock: number; status: string; margin: number | null;
};

const EMPTY = { name: '', sku: '', category: '', unit: 'un', cost_price: 0, sale_price: 0, min_stock: 0 };
const brl = (n: number) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function ProductsPage() {
  const { t } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const term = t('product').toLowerCase();

  async function load() {
    setLoading(true);
    const { data } = await api.get('/products', { params: { search: search || undefined } });
    setItems(data);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const margin = form && Number(form.cost_price) > 0
    ? Math.round(((Number(form.sale_price) - Number(form.cost_price)) / Number(form.cost_price)) * 10000) / 100
    : null;

  async function save() {
    setSaving(true);
    try {
      const payload = { ...form, cost_price: Number(form.cost_price), sale_price: Number(form.sale_price), min_stock: Number(form.min_stock) };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post('/products', payload);
      setForm(null); setEditingId(null);
      toast.push(editingId ? 'Produto atualizado.' : 'Produto cadastrado.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function inactivate(id: string) {
    if (!confirm('Inativar este item? Ele some das listas, mas o histórico é mantido.')) return;
    await api.patch(`/products/${id}/inactivate`);
    toast.push('Item inativado.', 'success');
    await load();
  }

  return (
    <div>
      <PageHeader
        title={`${t('product')}s`}
        subtitle="Cadastro e precificação do catálogo"
        actions={!form && <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditingId(null); }}><IconPlus width={16} height={16} /> Novo {term}</button>}
      />

      <div className="row" style={{ marginBottom: 'var(--sp-4)', maxWidth: 440 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome ou SKU" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <button className="btn" onClick={load}>Buscar</button>
      </div>

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>{editingId ? 'Editar' : 'Novo'} {term}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--sp-4)' }}>
            <Field label="Nome*"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="SKU/código"><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Categoria"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Unidade"><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field label="Custo (R$)"><input className="input" type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></Field>
            <Field label="Revenda (R$)"><input className="input" type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
            <Field label="Estoque mínimo"><input className="input" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
          </div>
          <p className="muted mt-4">Margem estimada: <strong style={{ color: 'var(--color-text)' }}>{margin == null ? '—' : `${margin}%`}</strong></p>
          <div className="row mt-2">
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn" onClick={() => { setForm(null); setEditingId(null); }}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconBox />} title={`Nenhum ${term} ainda`} hint="Cadastre o primeiro item do catálogo." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>SKU</th><th>Custo</th><th>Revenda</th><th>Margem</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="muted">{p.sku || '—'}</td>
                  <td>{brl(p.cost_price)}</td>
                  <td>{brl(p.sale_price)}</td>
                  <td>{p.margin == null ? '—' : `${p.margin}%`}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 'var(--sp-2)' }}>
                      <button className="btn btn-sm" onClick={() => { setForm({ name: p.name, sku: p.sku || '', category: p.category || '', unit: p.unit, cost_price: p.cost_price, sale_price: p.sale_price, min_stock: p.min_stock }); setEditingId(p.id); }}>Editar</button>
                      {p.status === 'active' && <button className="btn btn-sm" onClick={() => inactivate(p.id)}>Inativar</button>}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label>{children}</div>;
}
