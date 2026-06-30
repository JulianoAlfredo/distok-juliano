import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { maskCPF, maskCNPJ, maskPhone } from '../../lib/format';
import { IconPerson, IconPlus, IconSearch, IconHistory, IconClose } from '../../components/ui/icons';

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  status: string;
};

type Page = { items: Customer[]; total: number; page: number; pages: number };

type HistoryEntry = {
  id: string;
  action: string;
  before_json: string | null;
  after_json: string | null;
  created_at: string;
  user_name: string | null;
};

const EMPTY = {
  name: '', email: '', phone: '', cpf: '', cnpj: '',
  address: '', city: '', state: '', notes: '',
};

const ACTION_LABEL: Record<string, string> = {
  'customer.create': 'Cadastro',
  'customer.update': 'Edição',
  'customer.inactivate': 'Inativação',
  'customer.activate': 'Reativação',
};

export function CustomersPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [page, setPage] = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [form, setForm] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<{ customer: { id: string; name: string }; entries: HistoryEntry[] } | null>(null);

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/customers', {
        params: {
          search: search || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page: p,
        },
      });
      setPage(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); setCurrentPage(1); /* eslint-disable-next-line */ }, [statusFilter]);
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  async function save() {
    if (!form.name.trim()) return toast.push('Informe o nome do cliente.', 'error');
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await api.put(`/customers/${editingId}`, payload);
      } else {
        await api.post('/customers', payload);
      }
      setForm(null);
      setEditingId(null);
      toast.push(editingId ? 'Cliente atualizado com sucesso.' : 'Cliente cadastrado com sucesso.', 'success');
      await load(editingId ? currentPage : 1);
      if (!editingId) setCurrentPage(1);
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(c: Customer) {
    const isActive = c.status === 'active';
    if (isActive) {
      const ok = await confirm({
        title: `Inativar "${c.name}"?`,
        message: 'O cliente deixa de aparecer nas listas, mas o histórico é mantido. Você pode reativar depois.',
        confirmText: 'Sim, inativar',
        danger: true,
      });
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

  function startEdit(c: Customer) {
    setForm({
      name: c.name, email: c.email || '', phone: c.phone || '',
      cpf: c.cpf || '', cnpj: c.cnpj || '', address: c.address || '',
      city: c.city || '', state: c.state || '', notes: c.notes || '',
    });
    setEditingId(c.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelForm() {
    setForm(null);
    setEditingId(null);
  }

  const { items, total, pages } = page;

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastre e gerencie os clientes da distribuidora"
        actions={
          !form && (
            <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditingId(null); }}>
              <IconPlus width={16} height={16} /> Novo cliente
            </button>
          )
        }
      />

      {/* Filtros */}
      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 380 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-faint)' }}>
            <IconSearch width={18} height={18} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 38 }}
            placeholder="Buscar por nome, e-mail, telefone, CPF ou CNPJ"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); load(1); } }}
          />
        </div>
        <button className="btn" onClick={() => { setCurrentPage(1); load(1); }}>Buscar</button>
        <div className="seg">
          <button className={`seg-btn${statusFilter === 'all' ? ' active' : ''}`} onClick={() => setStatusFilter('all')}>Todos</button>
          <button className={`seg-btn${statusFilter === 'active' ? ' active' : ''}`} onClick={() => setStatusFilter('active')}>Ativos</button>
          <button className={`seg-btn${statusFilter === 'inactive' ? ' active' : ''}`} onClick={() => setStatusFilter('inactive')}>Inativos</button>
        </div>
      </div>

      {/* Formulário */}
      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>{editingId ? 'Editar cliente' : 'Novo cliente'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
            <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <FieldLabel required>Nome completo</FieldLabel>
              <input className="input" placeholder="Ex.: Maria da Silva" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel>E-mail</FieldLabel>
              <input className="input" type="email" placeholder="cliente@email.com" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Só números — a máscara é aplicada sozinha.">Telefone</FieldLabel>
              <input className="input" placeholder="(00) 00000-0000" value={form.phone} inputMode="numeric"
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Pessoa física. Só números — a máscara é aplicada sozinha.">CPF</FieldLabel>
              <input className="input" placeholder="000.000.000-00" value={form.cpf} inputMode="numeric"
                onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Pessoa jurídica. Só números — a máscara é aplicada sozinha.">CNPJ</FieldLabel>
              <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj} inputMode="numeric"
                onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel>Endereço</FieldLabel>
              <input className="input" placeholder="Rua, número, complemento" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel>Cidade</FieldLabel>
              <input className="input" placeholder="Ex.: São Paulo" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel>Estado</FieldLabel>
              <select className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                <option value="">Selecione</option>
                {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <FieldLabel hint="Anotações internas sobre este cliente. Não é exibido para o cliente.">Observações</FieldLabel>
              <textarea className="input" rows={2} placeholder="Ex.: cliente preferencial, entrega às terças…" value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="row mt-4">
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            <button className="btn" onClick={cancelForm}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<IconPerson />}
            title="Nenhum cliente encontrado"
            hint={statusFilter !== 'all' || search ? 'Ajuste os filtros para ver mais resultados.' : 'Clique em "Novo cliente" para cadastrar o primeiro.'}
            action={!form && statusFilter === 'all' && !search && (
              <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY }); setEditingId(null); }}>
                <IconPlus width={16} height={16} /> Novo cliente
              </button>
            )}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>CPF / CNPJ</th>
                <th>Cidade / UF</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
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
                      <button className="btn btn-sm" onClick={() => toggleStatus(c)}>
                        {c.status === 'active' ? 'Inativar' : 'Reativar'}
                      </button>
                      <button className="btn btn-sm btn-ghost" title="Histórico" onClick={() => openHistory(c)}>
                        <IconHistory width={15} height={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Paginação */}
          <div className="pagination">
            <span className="pagination-info">
              {total} cliente{total !== 1 ? 's' : ''} — página {currentPage} de {pages}
            </span>
            <button className="btn btn-sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
              ← Anterior
            </button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>
              Próxima →
            </button>
          </div>
        </div>
      )}

      {/* Modal de histórico */}
      {history && (
        <div
          onClick={() => setHistory(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)', zIndex: 100 }}
        >
          <div
            className="card"
            style={{ width: 680, maxWidth: '95vw', maxHeight: '82vh', overflow: 'auto', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
              <h3>{history.customer.name} — Histórico</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setHistory(null)}><IconClose width={18} height={18} /></button>
            </div>
            {history.entries.length === 0 ? (
              <div style={{ padding: 'var(--sp-8)' }}>
                <EmptyState icon={<IconHistory />} title="Sem registros de alteração" hint="Alterações futuras aparecerão aqui." />
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead><tr><th>Data</th><th>Ação</th><th>Responsável</th><th>Alterações</th></tr></thead>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}
