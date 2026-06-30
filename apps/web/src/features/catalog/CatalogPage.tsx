import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { IconTag, IconPlus, IconClose } from '../../components/ui/icons';

type Category = { id: string; name: string };
type Unit     = { id: string; name: string; symbol: string };

export function CatalogPage() {
  const [tab, setTab] = useState<'categories' | 'units'>('categories');
  return (
    <div>
      <PageHeader title="Cadastros Auxiliares" subtitle="Categorias e unidades de medida dos produtos" />
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${tab === 'categories' ? ' active' : ''}`} onClick={() => setTab('categories')}>Categorias</button>
        <button className={`seg-btn${tab === 'units'      ? ' active' : ''}`} onClick={() => setTab('units')}>Unidades de Medida</button>
      </div>
      {tab === 'categories' ? <CategoriesPanel /> : <UnitsPanel />}
    </div>
  );
}

// ─── Categorias ───────────────────────────────────────────────────────────────

function CategoriesPanel() {
  const toast   = useToast();
  const confirm = useConfirm();
  const [items, setItems]   = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [saving, setSaving]   = useState(false);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/catalog/categories'); setItems(data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!newName.trim()) return toast.push('Informe o nome da categoria.', 'error');
    setSaving(true);
    try {
      await api.post('/catalog/categories', { name: newName.trim() });
      setNewName('');
      toast.push('Categoria criada.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar.', 'error');
    } finally { setSaving(false); }
  }

  async function remove(c: Category) {
    const ok = await confirm({ title: `Remover categoria "${c.name}"?`, message: 'Esta ação não pode ser desfeita. Produtos vinculados a esta categoria precisarão ser reclassificados.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/catalog/categories/${c.id}`);
      toast.push('Categoria removida.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível remover.', 'error');
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Nova categoria</h3>
        <div className="row">
          <div style={{ flex: 1 }}>
            <FieldLabel required>Nome</FieldLabel>
            <input className="input" placeholder="Ex.: Bebidas, Limpeza, Frios…" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()} autoFocus />
          </div>
          <div style={{ paddingTop: 22 }}>
            <button className="btn btn-primary" onClick={add} disabled={saving}>
              <IconPlus width={16} height={16} /> {saving ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </div>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconTag />} title="Nenhuma categoria cadastrada" hint="Adicione categorias para organizar seus produtos." />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Categoria</th><th></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td style={{ width: 50 }}>
                    <button className="btn btn-sm btn-ghost" title="Remover" onClick={() => remove(c)}>
                      <IconClose width={15} height={15} />
                    </button>
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

// ─── Unidades ─────────────────────────────────────────────────────────────────

function UnitsPanel() {
  const toast   = useToast();
  const confirm = useConfirm();
  const [items, setItems]     = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ name: '', symbol: '' });
  const [saving, setSaving]   = useState(false);

  async function load() {
    setLoading(true);
    try { const { data } = await api.get('/catalog/units'); setItems(data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim())   return toast.push('Informe o nome da unidade.', 'error');
    if (!form.symbol.trim()) return toast.push('Informe o símbolo.', 'error');
    setSaving(true);
    try {
      await api.post('/catalog/units', { name: form.name.trim(), symbol: form.symbol.trim() });
      setForm({ name: '', symbol: '' });
      toast.push('Unidade criada.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar.', 'error');
    } finally { setSaving(false); }
  }

  async function remove(u: Unit) {
    const ok = await confirm({ title: `Remover unidade "${u.name} (${u.symbol})"?`, message: 'Produtos que usam esta unidade precisarão ser atualizados.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/catalog/units/${u.id}`);
      toast.push('Unidade removida.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível remover.', 'error');
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Nova unidade de medida</h3>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <FieldLabel required>Nome</FieldLabel>
            <input className="input" placeholder="Ex.: Unidade, Caixa, Litro…" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div style={{ flex: 1 }}>
            <FieldLabel required hint="Abreviação usada nos produtos (ex.: un, cx, L).">Símbolo</FieldLabel>
            <input className="input" placeholder="un" value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
          <div>
            <button className="btn btn-primary" onClick={add} disabled={saving}>
              <IconPlus width={16} height={16} /> {saving ? 'Criando…' : 'Criar'}
            </button>
          </div>
        </div>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconTag />} title="Nenhuma unidade cadastrada" hint='Adicione unidades como "un", "cx", "kg" para usar nos produtos.' />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Símbolo</th><th></th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td><span className="badge badge-neutral">{u.symbol}</span></td>
                  <td style={{ width: 50 }}>
                    <button className="btn btn-sm btn-ghost" title="Remover" onClick={() => remove(u)}>
                      <IconClose width={15} height={15} />
                    </button>
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
