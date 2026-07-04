import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../auth/useAuth';
import { PageHeader, StatusBadge, EmptyState } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { IconLayers, IconSearch, IconPlus } from '../../components/ui/icons';

type Balance = { product_id: string; name: string; sku: string | null; current_stock: number; min_stock: number; below_min: boolean };
type Product  = { id: string; name: string; sku: string | null };

export function StockPage() {
  const { t } = useTheme();
  const location = useLocation();
  const [tab, setTab]         = useState<'saldo' | 'historico'>('saldo');
  const [launchOpen, setLaunchOpen] = useState(false);
  useEffect(() => { if ((location.state as any)?.autoOpen === 'new') setLaunchOpen(true); }, []); // eslint-disable-line

  return (
    <div>
      <PageHeader title={t('stock')} subtitle="Saldo atual e histórico de movimentações"
        actions={<button className="btn btn-primary" onClick={() => setLaunchOpen(true)}><IconPlus width={16} height={16} /> Lançar movimentação</button>}
      />
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${tab === 'saldo'     ? ' active' : ''}`} onClick={() => setTab('saldo')}>Saldo atual</button>
        <button className={`seg-btn${tab === 'historico' ? ' active' : ''}`} onClick={() => setTab('historico')}>Histórico</button>
      </div>
      {tab === 'saldo' ? <BalanceList onLaunch={() => setLaunchOpen(true)} /> : <MovementHistory />}
      <LaunchModal open={launchOpen} onClose={() => setLaunchOpen(false)} />
    </div>
  );
}

// ─── Modal de lançamento ──────────────────────────────────────────────────────

function LaunchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const toast    = useToast();
  const isAdmin  = user?.role === 'admin';
  const [type, setType]       = useState<'entry' | 'exit' | 'adjustment'>('entry');
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [picked, setPicked]   = useState<Product | null>(null);
  const [qty, setQty]         = useState(1);
  const [reason, setReason]   = useState('venda');
  const [note, setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setType('entry'); setQuery(''); setResults([]); setPicked(null); setQty(1); setReason('venda'); setNote(''); }
  }, [open]);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const h = setTimeout(() => {
      api.get('/products', { params: { search: query, status: 'active' } }).then(({ data }) => setResults(data.slice(0, 6)));
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  async function submit() {
    if (!picked) return toast.push('Selecione um produto.', 'error');
    setSubmitting(true);
    try {
      const body: any = { productId: picked.id, type, quantity: Number(qty) };
      if (type === 'exit')       body.reason = reason;
      if (type === 'adjustment') body.reason = reason || 'ajuste manual';
      if (note) body.note = note;
      const { data } = await api.post('/stock/movements', body);
      toast.push(`Registrado! Saldo: ${data.balanceAfter}${data.belowMin ? ' (abaixo do mínimo)' : ''}`, data.belowMin ? 'error' : 'success');
      onClose();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao registrar.', 'error');
    } finally { setSubmitting(false); }
  }

  const typeLabel = type === 'entry' ? 'entrada' : type === 'exit' ? 'saída' : 'ajuste';

  return (
    <Modal open={open} onClose={onClose} title="Lançar movimentação" size="md"
      footer={
        <>
          <button className="btn btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? 'Registrando…' : `Confirmar ${typeLabel}`}
          </button>
          <button className="btn" onClick={onClose}>Cancelar</button>
        </>
      }
    >
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${type === 'entry'      ? ' active' : ''}`} onClick={() => setType('entry')}>Entrada</button>
        <button className={`seg-btn${type === 'exit'       ? ' active' : ''}`} onClick={() => setType('exit')}>Saída</button>
        {isAdmin && <button className={`seg-btn${type === 'adjustment' ? ' active' : ''}`} onClick={() => setType('adjustment')}>Ajuste</button>}
      </div>

      <div className="field">
        <label>Produto</label>
        {picked ? (
          <div className="row-between" style={{ border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', padding: '10px var(--sp-3)' }}>
            <span style={{ fontWeight: 500 }}>{picked.name}{picked.sku ? <span className="faint"> · {picked.sku}</span> : ''}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setPicked(null)}>trocar</button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome ou código" value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
            {results.length > 0 && (
              <div style={{ border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', marginTop: 4, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                {results.map((p) => (
                  <div key={p.id} className="pick-row" onClick={() => { setPicked(p); setQuery(''); setResults([]); }}>
                    {p.name}{p.sku ? <span className="faint"> · {p.sku}</span> : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="field">
        <label>{type === 'adjustment' ? 'Novo saldo (absoluto)' : 'Quantidade'}</label>
        <div className="row" style={{ gap: 'var(--sp-2)' }}>
          <button className="btn" type="button" onClick={() => setQty((q) => Math.max(0, Number(q) - 1))}>−</button>
          <input className="input" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ textAlign: 'center', maxWidth: 110 }} />
          <button className="btn" type="button" onClick={() => setQty((q) => Number(q) + 1)}>+</button>
        </div>
      </div>

      {type === 'exit' && (
        <div className="field">
          <label>Motivo</label>
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="venda">Venda</option>
            <option value="perda">Perda</option>
            <option value="devolucao">Devolução</option>
            <option value="transferencia">Transferência</option>
          </select>
        </div>
      )}
      {type === 'adjustment' && (
        <div className="field">
          <label>Justificativa (obrigatória)</label>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: correção de contagem" />
        </div>
      )}
      <div className="field" style={{ marginBottom: 0 }}>
        <label>Observação (opcional)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}

// ─── Saldo atual ──────────────────────────────────────────────────────────────

function BalanceList({ onLaunch }: { onLaunch: () => void }) {
  const [items, setItems]     = useState<Balance[]>([]);
  const [belowMin, setBelowMin] = useState(false);
  const [search, setSearch]   = useState('');
  const [extract, setExtract] = useState<any | null>(null);

  async function load() {
    const { data } = await api.get('/stock/balance', { params: { belowMin: belowMin || undefined, search: search || undefined } });
    setItems(data);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [belowMin]);

  async function openExtract(productId: string) {
    const { data } = await api.get(`/stock/products/${productId}/movements`);
    setExtract(data);
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div style={{ position: 'relative', maxWidth: 300, flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar produto" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        </div>
        <label className="row" style={{ gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
          <input type="checkbox" checked={belowMin} onChange={(e) => setBelowMin(e.target.checked)} /> Só abaixo do mínimo
        </label>
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconLayers />} title="Nenhum item" hint="Ajuste os filtros ou cadastre produtos."
            action={<button className="btn btn-primary" onClick={onLaunch}><IconPlus width={16} height={16} /> Lançar movimentação</button>}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Produto</th><th>SKU</th><th>Saldo</th><th>Mínimo</th><th>Status</th></tr></thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.product_id} style={{ cursor: 'pointer' }} onClick={() => openExtract(b.product_id)}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td className="muted">{b.sku || '—'}</td>
                  <td style={{ fontWeight: 700 }}>{b.current_stock}</td>
                  <td className="muted">{b.min_stock}</td>
                  <td><StatusBadge status={b.below_min ? (b.current_stock === 0 ? 'zero' : 'low') : 'ok'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!extract} onClose={() => setExtract(null)} title={extract ? `${extract.product.name} — Extrato` : ''} size="lg">
        {extract && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Data</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Responsável</th><th>Motivo</th></tr></thead>
              <tbody>
                {extract.movements.map((m: any) => (
                  <tr key={m.id}>
                    <td className="muted">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                    <td>{m.type === 'entry' ? <span className="badge badge-success">Entrada</span> : m.type === 'exit' ? <span className="badge badge-danger">Saída</span> : <span className="badge badge-info">Ajuste</span>}</td>
                    <td>{m.quantity}</td>
                    <td style={{ fontWeight: 600 }}>{m.balance_after}</td>
                    <td className="muted">{m.user_name || '—'}</td>
                    <td className="muted">{m.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─── Histórico geral ──────────────────────────────────────────────────────────

function MovementHistory() {
  const [items, setItems]       = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [loading, setLoading]   = useState(true);

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/stock/movements', { params: { type: typeFilter || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: p } });
      setItems(data.items); setTotal(data.total); setPages(data.pages);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(1); setCurrentPage(1); /* eslint-disable-next-line */ }, [typeFilter]);
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div className="seg">
          <button className={`seg-btn${typeFilter === ''           ? ' active' : ''}`} onClick={() => setTypeFilter('')}>Todos</button>
          <button className={`seg-btn${typeFilter === 'entry'      ? ' active' : ''}`} onClick={() => setTypeFilter('entry')}>Entradas</button>
          <button className={`seg-btn${typeFilter === 'exit'       ? ' active' : ''}`} onClick={() => setTypeFilter('exit')}>Saídas</button>
          <button className={`seg-btn${typeFilter === 'adjustment' ? ' active' : ''}`} onClick={() => setTypeFilter('adjustment')}>Ajustes</button>
        </div>
        <div className="row" style={{ gap: 'var(--sp-2)' }}>
          <input className="input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ width: 150 }} title="De" />
          <span className="muted">até</span>
          <input className="input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ width: 150 }} title="Até" />
          <button className="btn" onClick={() => { setCurrentPage(1); load(1); }}>Filtrar</button>
        </div>
      </div>

      {loading ? <div style={{ padding: 'var(--sp-8)', textAlign: 'center' }}><span className="spin" /></div> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconLayers />} title="Nenhuma movimentação" hint="Ajuste os filtros para ver resultados." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Responsável</th><th>Motivo</th></tr></thead>
            <tbody>
              {items.map((m: any) => (
                <tr key={m.id}>
                  <td className="muted" style={{ whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ fontWeight: 500 }}>{m.product_name || '—'}</td>
                  <td>
                    {m.type === 'entry'      && <span className="badge badge-success">Entrada</span>}
                    {m.type === 'exit'       && <span className="badge badge-danger">Saída</span>}
                    {m.type === 'adjustment' && <span className="badge badge-info">Ajuste</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{m.quantity}</td>
                  <td>{m.balance_after}</td>
                  <td className="muted">{m.user_name || '—'}</td>
                  <td className="muted">{m.reason || m.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} movimentação{total !== 1 ? 'ões' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
        </div>
      )}
    </div>
  );
}
