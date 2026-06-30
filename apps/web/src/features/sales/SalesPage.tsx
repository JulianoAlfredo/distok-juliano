import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { formatBRL } from '../../lib/format';
import { IconPlus, IconSearch, IconClose, IconArrowUp } from '../../components/ui/icons';

type Customer = { id: string; name: string };
type Product  = { id: string; name: string; sku: string | null; unit: string; sale_price: number };
type CartItem = { productId: string; productName: string; unit: string; quantity: number; unitPrice: number; discount: number };
type Sale = {
  id: string; number: number; status: string; total: number; subtotal: number; discount: number;
  payment_method: string; sold_at: string; customer_name: string | null; user_name: string | null;
};
type Page = { items: Sale[]; total: number; page: number; pages: number };

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' }, { value: 'pix', label: 'Pix' },
  { value: 'cartao_debito', label: 'Cartão de Débito' }, { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'boleto', label: 'Boleto' }, { value: 'cheque', label: 'Cheque' },
];
const STATUS_BADGE: Record<string, string>  = { open: 'badge-success', cancelled: 'badge-neutral' };
const STATUS_LABEL: Record<string, string>  = { open: 'Concluída', cancelled: 'Cancelada' };

export function SalesPage() {
  const [tab, setTab] = useState<'list' | 'new'>('list');
  return (
    <div>
      <PageHeader title="Vendas" subtitle="Registre vendas e a baixa de estoque é feita automaticamente" />
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>Vendas</button>
        <button className={`seg-btn${tab === 'new'  ? ' active' : ''}`} onClick={() => setTab('new')}>Nova venda</button>
      </div>
      {tab === 'list' ? <SaleList onNew={() => setTab('new')} /> : <SaleForm onSaved={() => setTab('list')} />}
    </div>
  );
}

// ─── Lista ───────────────────────────────────────────────────────────────────

function SaleList({ onNew }: { onNew: () => void }) {
  const toast   = useToast();
  const confirm = useConfirm();
  const [page, setPage]               = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(true);
  const [detail, setDetail]           = useState<any | null>(null);

  async function load(p = currentPage) {
    setLoading(true);
    try { const { data } = await api.get('/sales', { params: { page: p } }); setPage(data); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  async function openDetail(id: string) {
    const { data } = await api.get(`/sales/${id}`);
    setDetail(data);
  }

  async function doCancel(id: string, num: number) {
    const ok = await confirm({ title: `Cancelar venda #${num}?`, message: 'O estoque dos itens vendidos será devolvido. Esta ação não pode ser desfeita.', confirmText: 'Cancelar venda', danger: true });
    if (!ok) return;
    try {
      await api.patch(`/sales/${id}/cancel`);
      toast.push('Venda cancelada e estoque estornado.', 'success');
      setDetail(null); load();
    } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao cancelar.', 'error'); }
  }

  const { items, total, pages } = page;
  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--sp-4)', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={onNew}><IconPlus width={16} height={16} /> Nova venda</button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconArrowUp />} title="Nenhuma venda registrada" hint='Clique em "Nova venda" para começar.' action={<button className="btn btn-primary" onClick={onNew}><IconPlus width={16} height={16} /> Nova venda</button>} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Cliente</th><th>Pagamento</th><th>Total</th><th>Data</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s.id)}>
                  <td style={{ fontWeight: 700 }}>#{s.number}</td>
                  <td>{s.customer_name || <span className="muted">Sem cliente</span>}</td>
                  <td className="muted">{PAYMENT_METHODS.find((m) => m.value === s.payment_method)?.label || s.payment_method}</td>
                  <td style={{ fontWeight: 600 }}>{formatBRL(Number(s.total))}</td>
                  <td className="muted">{new Date(s.sold_at).toLocaleDateString('pt-BR')}</td>
                  <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {s.status === 'open' && (
                      <button className="btn btn-sm" onClick={() => doCancel(s.id, s.number)}>Cancelar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} venda{total !== 1 ? 's' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
        </div>
      )}

      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)', zIndex: 100 }}>
          <div className="card" style={{ width: 640, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
              <div><h3>Venda #{detail.number}</h3><span className={`badge ${STATUS_BADGE[detail.status]}`}>{STATUS_LABEL[detail.status]}</span></div>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}><IconClose width={18} height={18} /></button>
            </div>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)' }}>
              <div className="grid-2" style={{ marginBottom: 'var(--sp-4)' }}>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Cliente</div><div>{detail.customer_name || '—'}</div></div>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Pagamento</div><div>{PAYMENT_METHODS.find((m) => m.value === detail.payment_method)?.label || detail.payment_method}</div></div>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Data</div><div>{new Date(detail.sold_at).toLocaleDateString('pt-BR')}</div></div>
                <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Responsável</div><div>{detail.user_name || '—'}</div></div>
              </div>
              <table className="table" style={{ marginBottom: 'var(--sp-4)' }}>
                <thead><tr><th>Produto</th><th>Qtd</th><th>Preço unit.</th><th>Desconto</th><th>Total</th></tr></thead>
                <tbody>
                  {detail.items.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.product_name}</td>
                      <td>{it.quantity} {it.unit}</td>
                      <td>{formatBRL(Number(it.unit_price))}</td>
                      <td className="muted">{Number(it.discount) > 0 ? formatBRL(Number(it.discount)) : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{formatBRL(Number(it.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ textAlign: 'right' }}>
                {Number(detail.discount) > 0 && <div className="muted">Desconto: {formatBRL(Number(detail.discount))}</div>}
                <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)' }}>{formatBRL(Number(detail.total))}</div>
              </div>
              {detail.status === 'open' && (
                <div className="row mt-4">
                  <button className="btn btn-sm" onClick={() => doCancel(detail.id, detail.number)}>Cancelar venda</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formulário de Nova Venda ─────────────────────────────────────────────────

function SaleForm({ onSaved }: { onSaved: () => void }) {
  const toast   = useToast();
  const [customers, setCustomers]   = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [notes, setNotes]           = useState('');
  const [cart, setCart]             = useState<CartItem[]>([]);
  const [productQuery, setProductQuery]     = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    api.get('/customers', { params: { status: 'active', page: 1 } })
      .then(({ data }) => setCustomers(data.items))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (productQuery.length < 1) { setProductResults([]); return; }
    const h = setTimeout(() => {
      api.get('/products', { params: { search: productQuery, status: 'active' } })
        .then(({ data }) => setProductResults(data.slice(0, 6)))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [productQuery]);

  function addProduct(p: Product) {
    setProductQuery(''); setProductResults([]);
    const existing = cart.find((i) => i.productId === p.id);
    if (existing) {
      setCart((prev) => prev.map((i) => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart((prev) => [...prev, { productId: p.id, productName: p.name, unit: p.unit, quantity: 1, unitPrice: Number(p.sale_price), discount: 0 }]);
    }
  }

  function updateCart(idx: number, field: keyof CartItem, val: number) {
    setCart((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice - i.discount, 0);
  const total    = Math.max(0, subtotal - globalDiscount);

  async function save() {
    if (cart.length === 0) return toast.push('Adicione ao menos um produto.', 'error');
    setSaving(true);
    try {
      await api.post('/sales', {
        customerId:    customerId || undefined,
        paymentMethod,
        notes:         notes || undefined,
        discount:      globalDiscount,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
      });
      toast.push('Venda registrada e estoque atualizado!', 'success');
      onSaved();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível registrar a venda.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Dados da venda</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)' }}>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Cliente</FieldLabel>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Sem cliente (venda avulsa)</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel required>Forma de pagamento</FieldLabel>
            <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel hint="Desconto aplicado sobre o total geral da venda.">Desconto geral</FieldLabel>
            <MoneyInput value={globalDiscount} onChange={setGlobalDiscount} />
          </div>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel>Observações</FieldLabel>
            <input className="input" placeholder="Ex.: entrega amanhã, pedido via WhatsApp…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Carrinho</h3>
        <div className="field">
          <FieldLabel>Adicionar produto</FieldLabel>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar produto por nome ou código"
              value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
            {productResults.length > 0 && (
              <div style={{ border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', marginTop: 4, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
                {productResults.map((p) => (
                  <div key={p.id} className="pick-row" onClick={() => addProduct(p)}>
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    {p.sku && <span className="faint"> · {p.sku}</span>}
                    <span className="muted" style={{ float: 'right', fontSize: 'var(--fs-xs)' }}>{formatBRL(Number(p.sale_price))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {cart.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 'var(--sp-6) 0', fontSize: 'var(--fs-sm)' }}>Carrinho vazio — busque um produto acima</p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 'var(--sp-4)' }}>
            <table className="table">
              <thead><tr><th>Produto</th><th>Qtd</th><th>Preço unit.</th><th>Desconto</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {cart.map((it, idx) => {
                  const itTotal = it.quantity * it.unitPrice - it.discount;
                  return (
                    <tr key={it.productId}>
                      <td style={{ fontWeight: 500 }}>{it.productName} <span className="muted" style={{ fontWeight: 400 }}>({it.unit})</span></td>
                      <td style={{ width: 110 }}>
                        <input className="input" type="number" min={1} value={it.quantity} style={{ textAlign: 'center' }}
                          onChange={(e) => updateCart(idx, 'quantity', Number(e.target.value))} />
                      </td>
                      <td style={{ width: 150 }}>
                        <MoneyInput value={it.unitPrice} onChange={(v) => updateCart(idx, 'unitPrice', v)} />
                      </td>
                      <td style={{ width: 150 }}>
                        <MoneyInput value={it.discount} onChange={(v) => updateCart(idx, 'discount', v)} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatBRL(Math.max(0, itTotal))}</td>
                      <td style={{ width: 40 }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}>
                          <IconClose width={15} height={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {cart.length > 0 && (
          <div style={{ textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)' }}>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Subtotal: {formatBRL(subtotal)}</div>
            {globalDiscount > 0 && <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Desconto geral: -{formatBRL(globalDiscount)}</div>}
            <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)', marginTop: 'var(--sp-1)' }}>{formatBRL(total)}</div>
          </div>
        )}
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={saving || cart.length === 0}>
          {saving ? 'Registrando…' : 'Finalizar venda'}
        </button>
        <button className="btn" onClick={onSaved}>Cancelar</button>
      </div>
    </div>
  );
}
