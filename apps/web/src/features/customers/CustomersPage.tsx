import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { maskCPF, maskCNPJ, maskPhone } from '../../lib/format';
import { IconPerson, IconPlus, IconSearch, IconHistory } from '../../components/ui/icons';

type Customer = { id: string; name: string; email: string | null; phone: string | null; cpf: string | null; cnpj: string | null; address: string | null; city: string | null; state: string | null; notes: string | null; status: string };
type Page = { items: Customer[]; total: number; page: number; pages: number };
type HistoryEntry = { id: string; action: string; before_json: string | null; after_json: string | null; created_at: string; user_name: string | null };

const EMPTY = { name: '', email: '', phone: '', cpf: '', cnpj: '', address: '', city: '', state: '', notes: '' };
const ACTION_LABEL: Record<string, string> = { 'customer.create': 'Cadastro', 'customer.update': 'Edição', 'customer.inactivate': 'Inativação', 'customer.activate': 'Reativação' };
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export function CustomersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const location = useLocation();
  const [page, setPage]                   = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage]     = useState(1);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [open, setOpen]                   = useState(false);
  const [form, setForm]                   = useState<any>({ ...EMPTY });
  const [editingId, setEditingId]         = useState<string | null>(null);
  const [history, setHistory]             = useState<{ customer: { id: string; name: string }; entries: HistoryEntry[] } | null>(null);
  useEffect(() => { if ((location.state as any)?.autoOpen === 'new') setOpen(true); }, []); // eslint-disable-line

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', { params: { search: search || undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page: p } });
      setPage(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(1); setCurrentPage(1); /* eslint-disable-next-line */ }, [statusFilter]);
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  function openNew()       { setForm({ ...EMPTY }); setEditingId(null); setOpen(true); }
  function startEdit(c: Customer) {
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', cpf: c.cpf || '', cnpj: c.cnpj || '', address: c.address || '', city: c.city || '', state: c.state || '', notes: c.notes || '' });
    setEditingId(c.id); setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast.push('Informe o nome do cliente.', 'error');
    setSaving(true);
    try {
      if (editingId) await api.put(`/customers/${editingId}`, form);
      else           await api.post('/customers', form);
      setOpen(false);
      toast.push(editingId ? 'Cliente atualizado.' : 'Cliente cadastrado.', 'success');
      await load(editingId ? currentPage : 1);
      if (!editingId) setCurrentPage(1);
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível salvar.', 'error');
    } finally { setSaving(false); }
  }

  async function toggleStatus(c: Customer) {
    if (c.status === 'active') {
      const ok = await confirm({ title: `Inativar "${c.name}"?`, message: 'O cliente deixa de aparecer nas listas, mas o histórico é mantido.', confirmText: 'Sim, inativar', danger: true });
      if (!ok) return;
      await api.patch(`/customers/${c.id}/inactivate`);
      toast.push('Cliente inativado.', 'success');
    } else {
      await api.patch(`/customers/${c.id}/activate`);
      toast.push('Cliente reativado.', 'success');
    }
    await load();
  }

  async function openHistory(c: Customer) {
    const { data } = await api.get(`/customers/${c.id}/history`);
    setHistory(data);
  }

  const { items, total, pages } = page;

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastre e gerencie os clientes da distribuidora"
        actions={<button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo cliente</button>}
      />

      <div className="row" style={{ marginBottom: 'var(--sp-5)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} aria-label="Buscar clientes" placeholder="Buscar por nome, e-mail, CPF ou CNPJ"
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
          <EmptyState icon={<IconPerson />} title="Nenhum cliente encontrado"
            hint={statusFilter !== 'all' || search ? 'Ajuste os filtros para ver mais resultados.' : 'Clique em "Novo cliente" para cadastrar o primeiro.'}
            action={statusFilter === 'all' && !search && <button className="btn btn-primary" onClick={openNew}><IconPlus width={16} height={16} /> Novo cliente</button>}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>Contato</th><th>CPF / CNPJ</th><th>Cidade / UF</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td className="muted">
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div style={{ fontSize: 'var(--fs-xs)' }}>{c.email}</div>}
                    {!c.phone && !c.email && '—'}
                  </td>
                  <td className="muted">{c.cpf || c.cnpj || '—'}</td>
                  <td className="muted">{[c.city, c.state].filter(Boolean).join(' / ') || '—'}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 'var(--sp-2)' }}>
                      <button className="btn btn-sm" onClick={() => startEdit(c)}>Editar</button>
                      <button className="btn btn-sm" onClick={() => toggleStatus(c)}>{c.status === 'active' ? 'Inativar' : 'Reativar'}</button>
                      <button className="btn btn-sm btn-ghost" title="Histórico" aria-label="Ver histórico" onClick={() => openHistory(c)}><IconHistory width={15} height={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} cliente{total !== 1 ? 's' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
        </div>
      )}

      {/* Modal formulário */}
      <Modal open={open} onClose={() => setOpen(false)} title={editingId ? 'Editar cliente' : 'Novo cliente'} size="lg"
        footer={
          <>
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn" onClick={() => setOpen(false)}>Cancelar</button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel required>Nome completo</FieldLabel>
            <input className="input" placeholder="Ex.: Maria da Silva" value={form.name} autoFocus onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>E-mail</FieldLabel>
            <input className="input" type="email" placeholder="cliente@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Telefone</FieldLabel>
            <input className="input" placeholder="(00) 00000-0000" value={form.phone} inputMode="numeric" onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Pessoa física.">CPF</FieldLabel>
            <input className="input" placeholder="000.000.000-00" value={form.cpf} inputMode="numeric" onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Pessoa jurídica.">CNPJ</FieldLabel>
            <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj} inputMode="numeric" onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Endereço</FieldLabel>
            <input className="input" placeholder="Rua, número, complemento" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Cidade</FieldLabel>
            <input className="input" placeholder="Ex.: São Paulo" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Estado</FieldLabel>
            <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
              <option value="">Selecione</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel hint="Anotações internas. Não exibido ao cliente.">Observações</FieldLabel>
            <textarea className="input" rows={2} placeholder="Ex.: cliente preferencial, entrega às terças…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Modal histórico */}
      <Modal open={!!history} onClose={() => setHistory(null)} title={history ? `${history.customer.name} — Histórico` : ''} size="lg">
        {history && (history.entries.length === 0 ? (
          <EmptyState icon={<IconHistory />} title="Sem registros de alteração" hint="Alterações futuras aparecerão aqui." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Campos</th></tr></thead>
              <tbody>
                {history.entries.map((e) => {
                  const after = e.after_json ? JSON.parse(e.after_json) : null;
                  const changedFields = after ? Object.keys(after).filter((k) => k !== 'id' && k !== 'tenant_id').join(', ') : null;
                  return (
                    <tr key={e.id}>
                      <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('pt-BR')}</td>
                      <td>{ACTION_LABEL[e.action] || e.action}</td>
                      <td className="muted">{e.user_name || '—'}</td>
                      <td className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{changedFields || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </Modal>
    </div>
  );
}
