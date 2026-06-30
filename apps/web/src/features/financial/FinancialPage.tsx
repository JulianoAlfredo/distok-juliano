import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { formatBRL } from '../../lib/format';
import { IconPlus, IconClose, IconTrendUp } from '../../components/ui/icons';

type FEntry = {
  id: string; type: 'receivable' | 'payable'; status: 'pending' | 'paid' | 'cancelled';
  description: string; amount: number; due_date: string; paid_at: string | null; paid_amount: number | null;
  category: string | null; supplier_name: string | null; customer_name: string | null;
};
type Page = { items: FEntry[]; total: number; page: number; pages: number };

const TYPE_LABEL: Record<string, string> = { receivable: 'A receber', payable: 'A pagar' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' };
const STATUS_BADGE: Record<string, string>  = { pending: 'badge-warning', paid: 'badge-success', cancelled: 'badge-neutral' };

export function FinancialPage() {
  const [tab, setTab] = useState<'list' | 'cashflow' | 'new'>('list');
  return (
    <div>
      <PageHeader title="Financeiro" subtitle="Contas a pagar, a receber e fluxo de caixa" />
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${tab === 'list'     ? ' active' : ''}`} onClick={() => setTab('list')}>Lançamentos</button>
        <button className={`seg-btn${tab === 'cashflow' ? ' active' : ''}`} onClick={() => setTab('cashflow')}>Fluxo de caixa</button>
        <button className={`seg-btn${tab === 'new'      ? ' active' : ''}`} onClick={() => setTab('new')}>Novo lançamento</button>
      </div>
      {tab === 'list'     && <EntryList onNew={() => setTab('new')} />}
      {tab === 'cashflow' && <CashflowView />}
      {tab === 'new'      && <EntryForm onSaved={() => setTab('list')} />}
    </div>
  );
}

// ─── Lista de lançamentos ─────────────────────────────────────────────────────

function EntryList({ onNew }: { onNew: () => void }) {
  const toast   = useToast();
  const confirm = useConfirm();
  const [page, setPage]   = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<FEntry | null>(null);

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/financial', { params: { type: typeFilter || undefined, status: statusFilter || undefined, page: p } });
      setPage(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { setCurrentPage(1); load(1); /* eslint-disable-next-line */ }, [typeFilter, statusFilter]);
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  async function doPay(entry: FEntry) {
    const ok = await confirm({ title: `Marcar como pago?`, message: `Lançamento: ${entry.description} — ${formatBRL(Number(entry.amount))}`, confirmText: 'Confirmar pagamento' });
    if (!ok) return;
    try { await api.patch(`/financial/${entry.id}/pay`, {}); toast.push('Marcado como pago!', 'success'); setSelected(null); load(); }
    catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro.', 'error'); }
  }

  async function doCancel(entry: FEntry) {
    const ok = await confirm({ title: `Cancelar lançamento?`, message: entry.description, confirmText: 'Cancelar', danger: true });
    if (!ok) return;
    try { await api.patch(`/financial/${entry.id}/cancel`); toast.push('Cancelado.', 'success'); setSelected(null); load(); }
    catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro.', 'error'); }
  }

  const { items, total, pages } = page;
  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div className="seg">
          <button className={`seg-btn${typeFilter === ''           ? ' active' : ''}`} onClick={() => setTypeFilter('')}>Todos</button>
          <button className={`seg-btn${typeFilter === 'receivable' ? ' active' : ''}`} onClick={() => setTypeFilter('receivable')}>A receber</button>
          <button className={`seg-btn${typeFilter === 'payable'    ? ' active' : ''}`} onClick={() => setTypeFilter('payable')}>A pagar</button>
        </div>
        <div className="seg">
          <button className={`seg-btn${statusFilter === ''          ? ' active' : ''}`} onClick={() => setStatusFilter('')}>Todos</button>
          <button className={`seg-btn${statusFilter === 'pending'   ? ' active' : ''}`} onClick={() => setStatusFilter('pending')}>Pendentes</button>
          <button className={`seg-btn${statusFilter === 'paid'      ? ' active' : ''}`} onClick={() => setStatusFilter('paid')}>Pagos</button>
          <button className={`seg-btn${statusFilter === 'cancelled' ? ' active' : ''}`} onClick={() => setStatusFilter('cancelled')}>Cancelados</button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-primary" onClick={onNew}><IconPlus width={16} height={16} /> Novo</button>
        </div>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconTrendUp />} title="Nenhum lançamento" hint='Clique em "Novo lançamento" para começar.' action={<button className="btn btn-primary" onClick={onNew}><IconPlus width={16} height={16} /> Novo</button>} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Vencimento</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((e) => {
                const overdue = e.status === 'pending' && new Date(e.due_date) < new Date();
                return (
                  <tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                    <td style={{ color: overdue ? 'var(--color-danger)' : undefined, fontWeight: overdue ? 600 : undefined }}>
                      {new Date(e.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}{overdue && ' ⚠'}
                    </td>
                    <td style={{ fontWeight: 500 }}>{e.description}</td>
                    <td className="muted">{TYPE_LABEL[e.type]}</td>
                    <td style={{ fontWeight: 600 }}>{formatBRL(Number(e.amount))}</td>
                    <td><span className={`badge ${STATUS_BADGE[e.status]}`}>{STATUS_LABEL[e.status]}</span></td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      {e.status === 'pending' && (
                        <div className="row" style={{ gap: 'var(--sp-2)' }}>
                          <button className="btn btn-sm btn-primary" onClick={() => doPay(e)}>Pago</button>
                          <button className="btn btn-sm" onClick={() => doCancel(e)}>Cancelar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} lançamento{total !== 1 ? 's' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
        </div>
      )}

      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)', zIndex: 100 }}>
          <div className="card" style={{ width: 480, maxWidth: '95vw', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--color-border)' }}>
              <h3>{selected.description}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}><IconClose width={18} height={18} /></button>
            </div>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)', display: 'grid', gap: 'var(--sp-3)' }}>
              <div className="row-between"><span className="muted">Tipo:</span><span>{TYPE_LABEL[selected.type]}</span></div>
              <div className="row-between"><span className="muted">Situação:</span><span className={`badge ${STATUS_BADGE[selected.status]}`}>{STATUS_LABEL[selected.status]}</span></div>
              <div className="row-between"><span className="muted">Valor:</span><strong>{formatBRL(Number(selected.amount))}</strong></div>
              <div className="row-between"><span className="muted">Vencimento:</span><span>{new Date(selected.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>
              {selected.paid_at && <div className="row-between"><span className="muted">Pago em:</span><span>{new Date(selected.paid_at + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>}
              {selected.paid_amount && <div className="row-between"><span className="muted">Valor pago:</span><span>{formatBRL(Number(selected.paid_amount))}</span></div>}
              {selected.category && <div className="row-between"><span className="muted">Categoria:</span><span>{selected.category}</span></div>}
              {selected.supplier_name && <div className="row-between"><span className="muted">Fornecedor:</span><span>{selected.supplier_name}</span></div>}
              {selected.customer_name && <div className="row-between"><span className="muted">Cliente:</span><span>{selected.customer_name}</span></div>}
              {selected.status === 'pending' && (
                <div className="row mt-4" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => doPay(selected)}>Marcar como pago</button>
                  <button className="btn btn-sm"             onClick={() => doCancel(selected)}>Cancelar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Fluxo de caixa ───────────────────────────────────────────────────────────

function CashflowView() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData]   = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { const { data: d } = await api.get('/financial/cashflow', { params: { year, month } }); setData(d); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [year, month]);

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const years  = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--sp-5)', gap: 'var(--sp-3)' }}>
        <select className="input" style={{ width: 100 }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input" style={{ width: 130 }} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
      </div>

      {loading ? <Loading /> : !data ? null : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <div className="card" style={{ borderTop: '3px solid var(--color-success)' }}>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Total a receber</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: 'var(--color-success)' }}>{formatBRL(data.totalReceivable)}</div>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Recebido: {formatBRL(data.totalReceived)}</div>
            </div>
            <div className="card" style={{ borderTop: '3px solid var(--color-danger)' }}>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Total a pagar</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: 'var(--color-danger)' }}>{formatBRL(data.totalPayable)}</div>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>Pago: {formatBRL(data.totalPaid)}</div>
            </div>
            <div className="card" style={{ borderTop: `3px solid ${data.balance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'}` }}>
              <div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo previsto</div>
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: data.balance >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
                {data.balance >= 0 ? '' : '-'}{formatBRL(Math.abs(data.balance))}
              </div>
            </div>
            {data.overdue.length > 0 && (
              <div className="card" style={{ borderTop: '3px solid var(--color-danger)' }}>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-danger)' }}>Vencidos</div>
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: 'var(--color-danger)' }}>{data.overdue.length}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>lançamentos em atraso</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Novo lançamento ──────────────────────────────────────────────────────────

function EntryForm({ onSaved }: { onSaved: () => void }) {
  const toast = useToast();
  const [type, setType]         = useState<'receivable' | 'payable'>('receivable');
  const [description, setDescription] = useState('');
  const [amount, setAmount]     = useState(0);
  const [dueDate, setDueDate]   = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes]       = useState('');
  const [saving, setSaving]     = useState(false);

  async function save() {
    if (!description.trim()) return toast.push('Informe a descrição.', 'error');
    if (amount <= 0)          return toast.push('Valor deve ser maior que zero.', 'error');
    if (!dueDate)             return toast.push('Informe o vencimento.', 'error');
    setSaving(true);
    try {
      await api.post('/financial', { type, description, amount, dueDate, category: category || undefined, notes: notes || undefined });
      toast.push('Lançamento criado!', 'success');
      onSaved();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar o lançamento.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 'var(--sp-5)' }}>Novo lançamento financeiro</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--sp-4)' }}>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel required>Tipo</FieldLabel>
          <div className="seg">
            <button className={`seg-btn${type === 'receivable' ? ' active' : ''}`} onClick={() => setType('receivable')}>A receber</button>
            <button className={`seg-btn${type === 'payable'    ? ' active' : ''}`} onClick={() => setType('payable')}>A pagar</button>
          </div>
        </div>
        <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
          <FieldLabel required>Descrição</FieldLabel>
          <input className="input" placeholder="Ex.: mensalidade de fornecedor, pagamento de cliente…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel required>Valor</FieldLabel>
          <MoneyInput value={amount} onChange={setAmount} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel required>Vencimento</FieldLabel>
          <input className="input" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel hint="Ex.: aluguel, comissão, matéria-prima">Categoria</FieldLabel>
          <input className="input" placeholder="Categoria (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
          <FieldLabel>Observações</FieldLabel>
          <input className="input" placeholder="Observações (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="row mt-5">
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar lançamento'}</button>
        <button className="btn" onClick={onSaved}>Cancelar</button>
      </div>
    </div>
  );
}
