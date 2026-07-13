import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { HistoryModal, HistoryEntry } from '../../components/ui/HistoryModal';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { BulkActionsBar } from '../../components/ui/BulkActionsBar';
import { useBulkSelection } from '../../hooks/useBulkSelection';
import { maskCPF, maskCNPJ, maskPhone } from '../../lib/format';
import { IconTruck, IconPlus, IconSearch, IconHistory } from '../../components/ui/icons';

type Supplier = { id: string; name: string; trade_name: string | null; cnpj: string | null; cpf: string | null; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; contact: string | null; notes: string | null; status: string };
type Page = { items: Supplier[]; total: number; page: number; pages: number };

const EMPTY = { name: '', trade_name: '', cnpj: '', cpf: '', email: '', phone: '', address: '', city: '', state: '', contact: '', notes: '' };
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const ACTION_LABEL: Record<string, string> = { 'supplier.create': 'Cadastro', 'supplier.update': 'Edição', 'supplier.inactivate': 'Inativação', 'supplier.activate': 'Reativação' };

export function SuppliersPage() {
  const toast   = useToast();
  const confirm = useConfirm();
  const [page, setPage]               = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [open, setOpen]               = useState(false);
  const [form, setForm]               = useState<any>({ ...EMPTY });
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [history, setHistory]         = useState<{ supplier: { id: string; name: string }; entries: HistoryEntry[] } | null>(null);
  const bulk = useBulkSelection(page.items);

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/suppliers', { params: { search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page: p } });
      setPage(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(1); setCurrentPage(1); /* eslint-disable-next-line */ }, [statusFilter]);
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  function openNew() { setForm({ ...EMPTY }); setEditingId(null); setOpen(true); }
  function startEdit(s: Supplier) {
    setForm({ name: s.name, trade_name: s.trade_name || '', cnpj: s.cnpj || '', cpf: s.cpf || '', email: s.email || '', phone: s.phone || '', address: s.address || '', city: s.city || '', state: s.state || '', contact: s.contact || '', notes: s.notes || '' });
    setEditingId(s.id); setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.push('Informe o nome do fornecedor.', 'error');
    setSaving(true);
    try {
      if (editingId) await api.put(`/suppliers/${editingId}`, form);
      else           await api.post('/suppliers', form);
      setOpen(false);
      toast.push(editingId ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.', 'success');
      await load(editingId ? currentPage : 1);
      if (!editingId) setCurrentPage(1);
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível salvar.', 'error');
    } finally { setSaving(false); }
  }

  async function toggleStatus(s: Supplier) {
    if (s.status === 'active') {
      const ok = await confirm({ title: `Inativar "${s.name}"?`, message: 'O fornecedor deixa de aparecer nas listas. Você pode reativar depois.', confirmText: 'Sim, inativar', danger: true });
      if (!ok) return;
      await api.patch(`/suppliers/${s.id}/inactivate`);
      toast.push('Fornecedor inativado.', 'success');
    } else {
      await api.patch(`/suppliers/${s.id}/activate`);
      toast.push('Fornecedor reativado.', 'success');
    }
    await load();
  }

  async function openHistory(s: Supplier) {
    const { data } = await api.get(`/suppliers/${s.id}/history`);
    setHistory(data);
  }

  async function bulkInactivate() {
    const targets = page.items.filter((s) => bulk.isSelected(s.id) && s.status === 'active');
    if (targets.length === 0) return;
    const ok = await confirm({ title: `Inativar ${targets.length} fornecedor(es)?`, message: 'Os fornecedores deixam de aparecer nas listas. Você pode reativar depois.', confirmText: 'Sim, inativar', danger: true });
    if (!ok) return;
    await Promise.all(targets.map((s) => api.patch(`/suppliers/${s.id}/inactivate`)));
    toast.push(`${targets.length} fornecedor(es) inativado(s).`, 'success');
    bulk.clear();
    await load();
  }

  async function bulkActivate() {
    const targets = page.items.filter((s) => bulk.isSelected(s.id) && s.status !== 'active');
    if (targets.length === 0) return;
    await Promise.all(targets.map((s) => api.patch(`/suppliers/${s.id}/activate`)));
    toast.push(`${targets.length} fornecedor(es) reativado(s).`, 'success');
    bulk.clear();
    await load();
  }

  const { items, total, pages } = page;
  const activeSelectedCount = items.filter((s) => bulk.isSelected(s.id) && s.status === 'active').length;
  const inactiveSelectedCount = items.filter((s) => bulk.isSelected(s.id) && s.status !== 'active').length;

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastre os fornecedores de produtos da distribuidora"
        actions={<button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo fornecedor</button>}
      />

      <div className="row" style={{ marginBottom: 'var(--sp-5)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" aria-label="Buscar fornecedores" style={{ paddingLeft: 38 }} placeholder="Buscar por nome, CNPJ ou e-mail"
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); load(1); } }} />
        </div>
        <button className="btn" onClick={() => { setCurrentPage(1); load(1); }}>Buscar</button>
        <div className="seg">
          <button className={`seg-btn${statusFilter === 'all'      ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>Todos</button>
          <button className={`seg-btn${statusFilter === 'active'   ? ' active' : ''}`} onClick={() => setStatusFilter('active')}>Ativos</button>
          <button className={`seg-btn${statusFilter === 'inactive' ? ' active' : ''}`} onClick={() => setStatusFilter('inactive')}>Inativos</button>
        </div>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconTruck />} title="Nenhum fornecedor encontrado"
            hint={statusFilter !== 'all' || search ? 'Ajuste os filtros.' : 'Clique em "Novo fornecedor" para cadastrar o primeiro.'}
            action={statusFilter === 'all' && !search && <button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo fornecedor</button>}
          />
        </div>
      ) : (
        <>
          <BulkActionsBar count={bulk.count} onClear={bulk.clear}>
            {activeSelectedCount > 0 && <button className="btn btn-sm" onClick={bulkInactivate}>Inativar selecionados</button>}
            {inactiveSelectedCount > 0 && <button className="btn btn-sm" onClick={bulkActivate}>Reativar selecionados</button>}
          </BulkActionsBar>
          <div className="table-wrap">
          <table className="table">
            <thead><tr>
              <th className="bulk-col"><input type="checkbox" aria-label="Selecionar todos" checked={bulk.allSelected} onChange={bulk.toggleAll} /></th>
              <th>Nome / Fantasia</th><th>CNPJ / CPF</th><th>Contato</th><th>Cidade / UF</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="bulk-col"><input type="checkbox" aria-label={`Selecionar ${s.name}`} checked={bulk.isSelected(s.id)} onChange={() => bulk.toggle(s.id)} /></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {s.trade_name && <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{s.trade_name}</div>}
                  </td>
                  <td className="muted">{s.cnpj || s.cpf || '—'}</td>
                  <td className="muted">
                    {s.contact && <div>{s.contact}</div>}
                    {s.phone   && <div style={{ fontSize: 'var(--fs-xs)' }}>{s.phone}</div>}
                    {!s.contact && !s.phone && '—'}
                  </td>
                  <td className="muted">{[s.city, s.state].filter(Boolean).join(' / ') || '—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 'var(--sp-2)' }}>
                      <button className="btn btn-sm" onClick={() => startEdit(s)}>Editar</button>
                      <button className="btn btn-sm" onClick={() => toggleStatus(s)}>{s.status === 'active' ? 'Inativar' : 'Reativar'}</button>
                      <button className="btn btn-sm btn-ghost" title="Histórico" aria-label="Ver histórico" onClick={() => openHistory(s)}><IconHistory width={15} height={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} fornecedor{total !== 1 ? 'es' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Editar fornecedor' : 'Novo fornecedor'} size="lg"
        footer={
          <>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn" onClick={() => setOpen(false)}>Cancelar</button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel required>Razão Social / Nome</FieldLabel>
            <input className="input" placeholder="Ex.: Distribuidora ABC Ltda" value={form.name} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Nome fantasia ou nome comercial.">Nome Fantasia</FieldLabel>
            <input className="input" placeholder="Ex.: ABC Bebidas" value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>CNPJ</FieldLabel>
            <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj} inputMode="numeric" onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>CPF</FieldLabel>
            <input className="input" placeholder="000.000.000-00" value={form.cpf} inputMode="numeric" onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>E-mail</FieldLabel>
            <input className="input" type="email" placeholder="contato@fornecedor.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Telefone</FieldLabel>
            <input className="input" placeholder="(00) 00000-0000" value={form.phone} inputMode="numeric" onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Pessoa de contato no fornecedor.">Contato</FieldLabel>
            <input className="input" placeholder="Ex.: João Vendas" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Endereço</FieldLabel>
            <input className="input" placeholder="Rua, número, complemento" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Cidade</FieldLabel>
            <input className="input" placeholder="Ex.: Curitiba" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Estado</FieldLabel>
            <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              <option value="">Selecione</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel>Observações</FieldLabel>
            <textarea className="input" rows={2} placeholder="Ex.: prazo 30 dias, entrega às quartas…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      <HistoryModal
        open={!!history}
        onClose={() => setHistory(null)}
        title={history ? `${history.supplier.name} — Histórico` : ''}
        entries={history?.entries || []}
        actionLabels={ACTION_LABEL}
      />
    </div>
  );
}
