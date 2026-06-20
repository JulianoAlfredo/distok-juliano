import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  unit: string;
  cost_price: number;
  sale_price: number;
  min_stock: number;
  status: string;
  margin: number | null;
};

const EMPTY = { name: '', sku: '', category: '', unit: 'un', cost_price: 0, sale_price: 0, min_stock: 0 };

export function ProductsPage() {
  const { t } = useTheme();
  const [items, setItems] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>(null); // null = fechado; objeto = criando/editando
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setMsg(null);
    try {
      const payload = {
        ...form,
        cost_price: Number(form.cost_price),
        sale_price: Number(form.sale_price),
        min_stock: Number(form.min_stock),
      };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post('/products', payload);
      setForm(null); setEditingId(null);
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message || 'Erro ao salvar.');
    }
  }

  async function inactivate(id: string) {
    if (!confirm('Inativar este item? Ele some das listas, mas o histórico é mantido.')) return;
    await api.patch(`/products/${id}/inactivate`);
    await load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>{t('product')}s</h2>
        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditingId(null); }}>
          + Novo {t('product').toLowerCase()}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-2)', margin: 'var(--sp-3) 0' }}>
        <input className="input" placeholder="Buscar por nome ou SKU" value={search}
          onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <button className="btn" style={{ border: '1px solid var(--color-border)' }} onClick={load}>Buscar</button>
      </div>

      {msg && <div className="error-text">{msg}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 style={{ marginTop: 0 }}>{editingId ? 'Editar' : 'Novo'} {t('product').toLowerCase()}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--sp-3)' }}>
            <Field label="Nome*"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="SKU/código"><input className="input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
            <Field label="Categoria"><input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <Field label="Unidade"><input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></Field>
            <Field label="Custo (R$)"><input className="input" type="number" step="0.01" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} /></Field>
            <Field label="Revenda (R$)"><input className="input" type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} /></Field>
            <Field label="Estoque mínimo"><input className="input" type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></Field>
          </div>
          <p style={{ color: 'var(--color-text-mut)' }}>Margem: <strong>{margin == null ? '—' : `${margin}%`}</strong></p>
          <button className="btn btn-primary" onClick={save}>Salvar</button>
          <button className="btn" style={{ marginLeft: 'var(--sp-2)', border: '1px solid var(--color-border)' }} onClick={() => { setForm(null); setEditingId(null); }}>Cancelar</button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? <div style={{ padding: 'var(--sp-6)' }}>Carregando...</div> : items.length === 0 ? (
          <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--color-text-mut)' }}>
            Nenhum {t('product').toLowerCase()} ainda. Cadastre o primeiro.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <Th>Nome</Th><Th>SKU</Th><Th>Custo</Th><Th>Revenda</Th><Th>Margem</Th><Th>Status</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <Td>{p.name}</Td>
                  <Td>{p.sku || '—'}</Td>
                  <Td>R$ {Number(p.cost_price).toFixed(2)}</Td>
                  <Td>R$ {Number(p.sale_price).toFixed(2)}</Td>
                  <Td>{p.margin == null ? '—' : `${p.margin}%`}</Td>
                  <Td>{p.status === 'active' ? '🟢' : '⚪ inativo'}</Td>
                  <Td>
                    <button className="btn" style={{ border: '1px solid var(--color-border)', padding: '4px 8px' }}
                      onClick={() => { setForm({ name: p.name, sku: p.sku || '', category: p.category || '', unit: p.unit, cost_price: p.cost_price, sale_price: p.sale_price, min_stock: p.min_stock }); setEditingId(p.id); }}>
                      Editar
                    </button>
                    {p.status === 'active' && (
                      <button className="btn" style={{ marginLeft: 4, border: '1px solid var(--color-border)', padding: '4px 8px' }} onClick={() => inactivate(p.id)}>
                        Inativar
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label>{children}</div>;
}
function Th({ children }: { children?: React.ReactNode }) { return <th style={{ padding: 'var(--sp-3)' }}>{children}</th>; }
function Td({ children }: { children?: React.ReactNode }) { return <td style={{ padding: 'var(--sp-3)' }}>{children}</td>; }
