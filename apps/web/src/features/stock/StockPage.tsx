import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { useAuth } from '../../auth/useAuth';

type Balance = {
  product_id: string;
  name: string;
  sku: string | null;
  current_stock: number;
  min_stock: number;
  below_min: boolean;
};
type Product = { id: string; name: string; sku: string | null };

export function StockPage() {
  const [tab, setTab] = useState<'lancar' | 'saldo'>('lancar');
  const { t } = useTheme();
  return (
    <div>
      <h2 style={{ marginTop: 0 }}>{t('stock')}</h2>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        <TabBtn active={tab === 'lancar'} onClick={() => setTab('lancar')}>Lançar movimentação</TabBtn>
        <TabBtn active={tab === 'saldo'} onClick={() => setTab('saldo')}>Saldo atual</TabBtn>
      </div>
      {tab === 'lancar' ? <LaunchForm /> : <BalanceList />}
    </div>
  );
}

function LaunchForm() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [type, setType] = useState<'entry' | 'exit' | 'adjustment'>('entry');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [picked, setPicked] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [reason, setReason] = useState('venda');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (query.length < 1) { setResults([]); return; }
    const h = setTimeout(() => {
      api.get('/products', { params: { search: query, status: 'active' } }).then(({ data }) => setResults(data.slice(0, 6)));
    }, 250);
    return () => clearTimeout(h);
  }, [query]);

  async function submit() {
    if (!picked) return setMsg({ ok: false, text: 'Selecione um produto.' });
    setMsg(null);
    try {
      const body: any = { productId: picked.id, type, quantity: Number(qty) };
      if (type === 'exit') body.reason = reason;
      if (type === 'adjustment') body.reason = reason || 'ajuste manual';
      if (note) body.note = note;
      const { data } = await api.post('/stock/movements', body);
      setMsg({ ok: true, text: `✓ Registrado. Saldo atual: ${data.balanceAfter}${data.belowMin ? ' ⚠ abaixo do mínimo' : ''}` });
      setQty(1); setNote('');
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.error?.message || 'Erro ao registrar.' });
    }
  }

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
        <TypeBtn active={type === 'entry'} onClick={() => setType('entry')}>Entrada</TypeBtn>
        <TypeBtn active={type === 'exit'} onClick={() => setType('exit')}>Saída</TypeBtn>
        {isAdmin && <TypeBtn active={type === 'adjustment'} onClick={() => setType('adjustment')}>Ajuste</TypeBtn>}
      </div>

      <div className="field">
        <label>Produto</label>
        {picked ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)' }}>
            <span>{picked.name} {picked.sku ? `(${picked.sku})` : ''}</span>
            <button className="btn" style={{ border: '1px solid var(--color-border)', padding: '2px 8px' }} onClick={() => setPicked(null)}>trocar</button>
          </div>
        ) : (
          <>
            <input className="input" placeholder="🔎 buscar por nome ou código" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
            {results.length > 0 && (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', marginTop: 4 }}>
                {results.map((p) => (
                  <div key={p.id} style={{ padding: 'var(--sp-3)', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                    onClick={() => { setPicked(p); setQuery(''); setResults([]); }}>
                    {p.name} {p.sku ? <span style={{ color: 'var(--color-text-mut)' }}>· {p.sku}</span> : ''}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="field">
        <label>{type === 'adjustment' ? 'Novo saldo (absoluto)' : 'Quantidade'}</label>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <button className="btn" style={{ border: '1px solid var(--color-border)' }} onClick={() => setQty((q) => Math.max(0, Number(q) - 1))}>−</button>
          <input className="input" type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ textAlign: 'center', maxWidth: 100 }} />
          <button className="btn" style={{ border: '1px solid var(--color-border)' }} onClick={() => setQty((q) => Number(q) + 1)}>+</button>
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

      <div className="field">
        <label>Observação (opcional)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      {msg && <div style={{ color: msg.ok ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: 'var(--sp-3)' }}>{msg.text}</div>}

      <button className="btn btn-primary" style={{ width: '100%' }} onClick={submit}>
        Confirmar {type === 'entry' ? 'entrada' : type === 'exit' ? 'saída' : 'ajuste'}
      </button>
    </div>
  );
}

function BalanceList() {
  const [items, setItems] = useState<Balance[]>([]);
  const [belowMin, setBelowMin] = useState(false);
  const [search, setSearch] = useState('');
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
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-3)', alignItems: 'center' }}>
        <input className="input" placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} style={{ maxWidth: 280 }} />
        <label style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
          <input type="checkbox" checked={belowMin} onChange={(e) => setBelowMin(e.target.checked)} /> Só abaixo do mínimo
        </label>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <Th>Produto</Th><Th>SKU</Th><Th>Saldo</Th><Th>Mín</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.product_id} style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }} onClick={() => openExtract(b.product_id)}>
                <Td>{b.name}</Td>
                <Td>{b.sku || '—'}</Td>
                <Td><strong>{b.current_stock}</strong></Td>
                <Td>{b.min_stock}</Td>
                <Td>{b.below_min ? (b.current_stock === 0 ? '🔴 zerado' : '🔴 abaixo') : '🟢'}</Td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && <div style={{ padding: 'var(--sp-6)', color: 'var(--color-text-mut)' }}>Nenhum item.</div>}
      </div>

      {extract && (
        <div onClick={() => setExtract(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)' }}>
          <div className="card" style={{ width: 640, maxWidth: '95vw', maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{extract.product.name} — Extrato</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <Th>Data</Th><Th>Tipo</Th><Th>Qtd</Th><Th>Saldo</Th><Th>Quem</Th><Th>Motivo</Th>
              </tr></thead>
              <tbody>
                {extract.movements.map((m: any) => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <Td>{new Date(m.created_at).toLocaleString('pt-BR')}</Td>
                    <Td>{m.type === 'entry' ? 'entrada' : m.type === 'exit' ? 'saída' : 'ajuste'}</Td>
                    <Td>{m.quantity}</Td>
                    <Td>{m.balance_after}</Td>
                    <Td>{m.user_name || '—'}</Td>
                    <Td>{m.reason || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn" style={{ marginTop: 'var(--sp-4)', border: '1px solid var(--color-border)' }} onClick={() => setExtract(null)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return <button className="btn" onClick={onClick} style={{ border: '1px solid var(--color-border)', background: active ? 'var(--color-primary)' : 'transparent', color: active ? 'var(--on-primary)' : 'inherit' }}>{children}</button>;
}
function TypeBtn({ active, onClick, children }: any) {
  return <button className="btn" onClick={onClick} style={{ flex: 1, border: '1px solid var(--color-border)', background: active ? 'var(--color-primary)' : 'transparent', color: active ? 'var(--on-primary)' : 'inherit' }}>{children}</button>;
}
function Th({ children }: { children?: React.ReactNode }) { return <th style={{ padding: 'var(--sp-3)' }}>{children}</th>; }
function Td({ children }: { children?: React.ReactNode }) { return <td style={{ padding: 'var(--sp-3)' }}>{children}</td>; }
