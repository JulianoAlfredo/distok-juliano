import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { formatBRL } from '../../lib/format';
import { IconPlus, IconClose } from '../../components/ui/icons';

type Entry   = { id: string; type: 'in' | 'out'; amount: number; description: string; created_at: string; user_name: string | null };
type Session = {
  id: string; status: 'open' | 'closed';
  opening_balance: number; closing_balance: number | null; current_balance: number;
  total_in: number; total_out: number;
  opened_at: string; closed_at: string | null;
  user_name: string | null; notes: string | null;
  entries: Entry[];
};

export function CashierPage() {
  const [tab, setTab] = useState<'current' | 'history'>('current');
  return (
    <div>
      <PageHeader title="Caixa" subtitle="Abertura, fechamento e lançamentos de entradas/saídas" />
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${tab === 'current' ? ' active' : ''}`} onClick={() => setTab('current')}>Caixa atual</button>
        <button className={`seg-btn${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>Histórico</button>
      </div>
      {tab === 'current' ? <CurrentCashier /> : <CashierHistory />}
    </div>
  );
}

// ─── Caixa Atual ──────────────────────────────────────────────────────────────

function CurrentCashier() {
  const toast   = useToast();
  const confirm = useConfirm();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [showOpen,  setShowOpen]  = useState(false);
  const [showEntry, setShowEntry] = useState(false);
  const [showClose, setShowClose] = useState(false);

  async function load() {
    try { const { data } = await api.get('/cashier/current'); setSession(data || null); }
    catch { setSession(null); }
  }
  useEffect(() => { load(); }, []);

  if (session === undefined) return <Loading />;

  return (
    <div>
      {!session ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
          <div className="muted" style={{ marginBottom: 'var(--sp-4)' }}>Nenhum caixa aberto no momento.</div>
          <button className="btn btn-primary" onClick={() => setShowOpen(true)}><IconPlus width={16} height={16} /> Abrir caixa</button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <MetricCard label="Saldo atual"  value={formatBRL(Number(session.current_balance))} highlight />
            <MetricCard label="Saldo inicial" value={formatBRL(Number(session.opening_balance))} />
            <MetricCard label="Entradas"     value={formatBRL(session.total_in)}  color="var(--color-success)" />
            <MetricCard label="Saídas"       value={formatBRL(session.total_out)} color="var(--color-danger)"  />
          </div>

          <div className="row" style={{ marginBottom: 'var(--sp-4)', gap: 'var(--sp-3)' }}>
            <button className="btn btn-primary" onClick={() => setShowEntry(true)}><IconPlus width={16} height={16} /> Lançamento</button>
            <button className="btn" onClick={() => setShowClose(true)}>Fechar caixa</button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--sp-4)' }}>Movimentações da sessão</h3>
            {session.entries.length === 0 ? (
              <p className="muted" style={{ textAlign: 'center', padding: 'var(--sp-4) 0' }}>Nenhum lançamento ainda.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Hora</th><th>Descrição</th><th>Tipo</th><th>Valor</th><th>Responsável</th></tr></thead>
                  <tbody>
                    {session.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="muted">{new Date(e.created_at).toLocaleTimeString('pt-BR')}</td>
                        <td>{e.description}</td>
                        <td>{e.type === 'in' ? <span className="badge badge-success">Entrada</span> : <span className="badge badge-danger">Saída</span>}</td>
                        <td style={{ fontWeight: 600, color: e.type === 'in' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {e.type === 'in' ? '+' : '-'}{formatBRL(Number(e.amount))}
                        </td>
                        <td className="muted">{e.user_name || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showOpen && (
        <OpenDialog onClose={() => setShowOpen(false)} onSaved={(s) => { setSession(s); setShowOpen(false); toast.push('Caixa aberto com sucesso!', 'success'); }} />
      )}
      {showEntry && session && (
        <EntryDialog sessionId={session.id} onClose={() => setShowEntry(false)} onSaved={(s) => { setSession(s); setShowEntry(false); toast.push('Lançamento registrado!', 'success'); }} />
      )}
      {showClose && session && (
        <CloseDialog
          session={session}
          onClose={() => setShowClose(false)}
          onSaved={async () => {
            const ok = await confirm({ title: 'Fechar o caixa?', message: `Saldo a ser fechado: ${formatBRL(Number(session.current_balance))}. Esta ação não pode ser desfeita.`, confirmText: 'Fechar caixa', danger: true });
            if (!ok) { setShowClose(false); return; }
            try {
              await api.patch(`/cashier/sessions/${session.id}/close`, {});
              toast.push('Caixa fechado!', 'success');
              setSession(null); setShowClose(false);
            } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao fechar caixa.', 'error'); }
          }}
        />
      )}
    </div>
  );
}

function MetricCard({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div className="card" style={{ padding: 'var(--sp-4)', borderTop: highlight ? '3px solid var(--color-primary)' : undefined }}>
      <div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 'var(--sp-1)' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', color: color || (highlight ? 'var(--color-primary)' : undefined) }}>{value}</div>
    </div>
  );
}

function OpenDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (s: Session) => void }) {
  const toast = useToast();
  const [balance, setBalance] = useState(0);
  const [notes, setNotes]     = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try { const { data } = await api.post('/cashier/sessions', { openingBalance: balance, notes: notes || undefined }); onSaved(data); }
    catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao abrir caixa.', 'error'); }
    finally { setLoading(false); }
  }
  return (
    <DialogWrap title="Abrir caixa" onClose={onClose}>
      <div className="field"><FieldLabel hint="Dinheiro em espécie disponível no caixa.">Saldo inicial</FieldLabel><MoneyInput value={balance} onChange={setBalance} /></div>
      <div className="field"><FieldLabel>Observações</FieldLabel><input className="input" placeholder="Opcional" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <div className="row mt-4">
        <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Abrindo…' : 'Abrir caixa'}</button>
        <button className="btn" onClick={onClose}>Cancelar</button>
      </div>
    </DialogWrap>
  );
}

function EntryDialog({ sessionId, onClose, onSaved }: { sessionId: string; onClose: () => void; onSaved: (s: Session) => void }) {
  const toast = useToast();
  const [type, setType]         = useState<'in' | 'out'>('in');
  const [amount, setAmount]     = useState(0);
  const [description, setDescription] = useState('');
  const [loading, setLoading]   = useState(false);
  async function submit() {
    if (!description.trim()) return toast.push('Informe a descrição.', 'error');
    if (amount <= 0)          return toast.push('Valor deve ser maior que zero.', 'error');
    setLoading(true);
    try { const { data } = await api.post(`/cashier/sessions/${sessionId}/entries`, { type, amount, description }); onSaved(data); }
    catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao registrar lançamento.', 'error'); }
    finally { setLoading(false); }
  }
  return (
    <DialogWrap title="Novo lançamento" onClose={onClose}>
      <div className="field">
        <FieldLabel required>Tipo</FieldLabel>
        <div className="seg">
          <button className={`seg-btn${type === 'in'  ? ' active' : ''}`} onClick={() => setType('in')}>Entrada</button>
          <button className={`seg-btn${type === 'out' ? ' active' : ''}`} onClick={() => setType('out')}>Saída</button>
        </div>
      </div>
      <div className="field"><FieldLabel required>Valor</FieldLabel><MoneyInput value={amount} onChange={setAmount} /></div>
      <div className="field"><FieldLabel required>Descrição</FieldLabel><input className="input" placeholder="Ex.: sangria para despesas, troco…" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
      <div className="row mt-4">
        <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? 'Salvando…' : 'Registrar'}</button>
        <button className="btn" onClick={onClose}>Cancelar</button>
      </div>
    </DialogWrap>
  );
}

function CloseDialog({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => void }) {
  return (
    <DialogWrap title="Fechar caixa" onClose={onClose}>
      <div style={{ display: 'grid', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        <div className="row-between"><span className="muted">Saldo inicial:</span><span>{formatBRL(Number(session.opening_balance))}</span></div>
        <div className="row-between"><span className="muted">Entradas:</span><span style={{ color: 'var(--color-success)' }}>+{formatBRL(session.total_in)}</span></div>
        <div className="row-between"><span className="muted">Saídas:</span><span style={{ color: 'var(--color-danger)' }}>-{formatBRL(session.total_out)}</span></div>
        <hr style={{ borderColor: 'var(--color-border)' }} />
        <div className="row-between"><strong>Saldo final:</strong><strong style={{ fontSize: 'var(--fs-xl)', color: 'var(--color-primary)' }}>{formatBRL(Number(session.current_balance))}</strong></div>
      </div>
      <div className="row">
        <button className="btn btn-primary" onClick={onSaved}>Confirmar fechamento</button>
        <button className="btn" onClick={onClose}>Cancelar</button>
      </div>
    </DialogWrap>
  );
}

function DialogWrap({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)', zIndex: 100 }}>
      <div className="card" style={{ width: 480, maxWidth: '95vw', padding: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--color-border)' }}>
          <h3>{title}</h3>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><IconClose width={18} height={18} /></button>
        </div>
        <div style={{ padding: 'var(--sp-5) var(--sp-6)' }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Histórico ────────────────────────────────────────────────────────────────

function CashierHistory() {
  const [page, setPage]     = useState<any>({ items: [], total: 0, page: 1, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Session | null>(null);

  async function load(p = currentPage) {
    setLoading(true);
    try { const { data } = await api.get('/cashier/sessions', { params: { page: p } }); setPage(data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  async function openDetail(id: string) {
    const { data } = await api.get(`/cashier/sessions/${id}`);
    setDetail(data);
  }

  const { items, total, pages } = page;
  return (
    <div>
      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState title="Nenhuma sessão de caixa" hint="Abra o primeiro caixa na aba 'Caixa atual'." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Abertura</th><th>Fechamento</th><th>Saldo inicial</th><th>Saldo final</th><th>Situação</th><th>Responsável</th></tr></thead>
            <tbody>
              {items.map((s: any) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s.id)}>
                  <td>{new Date(s.opened_at).toLocaleString('pt-BR')}</td>
                  <td className="muted">{s.closed_at ? new Date(s.closed_at).toLocaleString('pt-BR') : '—'}</td>
                  <td>{formatBRL(Number(s.opening_balance))}</td>
                  <td style={{ fontWeight: 600 }}>{s.closing_balance != null ? formatBRL(Number(s.closing_balance)) : '—'}</td>
                  <td>{s.status === 'open' ? <span className="badge badge-success">Aberto</span> : <span className="badge badge-neutral">Fechado</span>}</td>
                  <td className="muted">{s.user_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} sessão{total !== 1 ? 'ões' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
        </div>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)', zIndex: 100 }}>
          <div className="card" style={{ width: 640, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
              <div><h3>Sessão de caixa</h3><span className={`badge ${detail.status === 'open' ? 'badge-success' : 'badge-neutral'}`}>{detail.status === 'open' ? 'Aberta' : 'Fechada'}</span></div>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}><IconClose width={18} height={18} /></button>
            </div>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)' }}>
              <div className="grid-2" style={{ marginBottom: 'var(--sp-5)' }}>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo inicial</div><div>{formatBRL(Number(detail.opening_balance))}</div></div>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Saldo final</div><div style={{ fontWeight: 600 }}>{detail.closing_balance != null ? formatBRL(Number(detail.closing_balance)) : <span className="muted">Aberto</span>}</div></div>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Entradas</div><div style={{ color: 'var(--color-success)' }}>+{formatBRL(detail.total_in)}</div></div>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Saídas</div><div style={{ color: 'var(--color-danger)' }}>-{formatBRL(detail.total_out)}</div></div>
              </div>
              {detail.entries.length === 0 ? (
                <p className="muted" style={{ textAlign: 'center' }}>Nenhum lançamento nesta sessão.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Hora</th><th>Descrição</th><th>Tipo</th><th>Valor</th></tr></thead>
                  <tbody>
                    {detail.entries.map((e) => (
                      <tr key={e.id}>
                        <td className="muted">{new Date(e.created_at).toLocaleTimeString('pt-BR')}</td>
                        <td>{e.description}</td>
                        <td>{e.type === 'in' ? <span className="badge badge-success">Entrada</span> : <span className="badge badge-danger">Saída</span>}</td>
                        <td style={{ fontWeight: 600, color: e.type === 'in' ? 'var(--color-success)' : 'var(--color-danger)' }}>{e.type === 'in' ? '+' : '-'}{formatBRL(Number(e.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
