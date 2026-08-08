import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
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
  const [items, setItems]     = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
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
      setOpen(false); setNewName('');
      toast.push('Categoria criada.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar.', 'error');
    } finally { setSaving(false); }
  }

  async function remove(c: Category) {
    const ok = await confirm({ title: `Remover categoria "${c.name}"?`, message: 'Produtos vinculados precisarão ser reclassificados.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/catalog/categories/${c.id}`);
      toast.push('Categoria removida.', 'success');
      await load();
    } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Não foi possível remover.', 'error'); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-4)' }}>
        <button className="btn btn-primary" onClick={() => { setNewName(''); setOpen(true); }}>
          <IconPlus width={16} height={16} /> Nova categoria
        </button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconTag />} title="Nenhuma categoria cadastrada" hint="Adicione categorias para organizar seus produtos."
            action={<button className="btn btn-primary" onClick={() => setOpen(true)}><IconPlus width={16} height={16} /> Nova categoria</button>}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Categoria</th><th></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }} data-label="Categoria">{c.name}</td>
                  <td style={{ width: 50 }}>
                    <button className="btn btn-sm btn-ghost" title="Remover" aria-label="Remover" onClick={() => remove(c)}>
                      <IconClose width={15} height={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova categoria" size="sm"
        footer={
          <>
            <button className="btn btn-primary" onClick={add} disabled={saving}>{saving ? 'Criando…' : 'Criar'}</button>
            <button className="btn" onClick={() => setOpen(false)}>Cancelar</button>
          </>
        }
      >
        <div className="field" style={{ marginBottom: 0 }}>
          <FieldLabel required>Nome da categoria</FieldLabel>
          <input className="input" placeholder="Ex.: Bebidas, Limpeza, Frios…" value={newName} autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
        </div>
      </Modal>
    </div>
  );
}

// ─── Unidades ─────────────────────────────────────────────────────────────────

function UnitsPanel() {
  const toast   = useToast();
  const confirm = useConfirm();
  const [items, setItems]     = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
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
      setOpen(false); setForm({ name: '', symbol: '' });
      toast.push('Unidade criada.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar.', 'error');
    } finally { setSaving(false); }
  }

  async function remove(u: Unit) {
    const ok = await confirm({ title: `Remover "${u.name} (${u.symbol})"?`, message: 'Produtos que usam esta unidade precisarão ser atualizados.', confirmText: 'Remover', danger: true });
    if (!ok) return;
    try {
      await api.delete(`/catalog/units/${u.id}`);
      toast.push('Unidade removida.', 'success');
      await load();
    } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Não foi possível remover.', 'error'); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--sp-4)' }}>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', symbol: '' }); setOpen(true); }}>
          <IconPlus width={16} height={16} /> Nova unidade
        </button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconTag />} title="Nenhuma unidade cadastrada" hint='Adicione unidades como "un", "cx", "kg" para usar nos produtos.'
            action={<button className="btn btn-primary" onClick={() => setOpen(true)}><IconPlus width={16} height={16} /> Nova unidade</button>}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Símbolo</th><th></th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }} data-label="Nome">{u.name}</td>
                  <td data-label="Símbolo"><span className="badge badge-neutral">{u.symbol}</span></td>
                  <td style={{ width: 50 }}>
                    <button className="btn btn-sm btn-ghost" title="Remover" aria-label="Remover" onClick={() => remove(u)}>
                      <IconClose width={15} height={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova unidade de medida" size="sm"
        footer={
          <>
            <button className="btn btn-primary" onClick={add} disabled={saving}>{saving ? 'Criando…' : 'Criar'}</button>
            <button className="btn" onClick={() => setOpen(false)}>Cancelar</button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel required>Nome</FieldLabel>
            <input className="input" placeholder="Ex.: Unidade, Caixa, Litro…" value={form.name} autoFocus
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel required hint="Abreviação usada nos produtos (ex.: un, cx, L).">Símbolo</FieldLabel>
            <input className="input" placeholder="un" value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && add()} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
