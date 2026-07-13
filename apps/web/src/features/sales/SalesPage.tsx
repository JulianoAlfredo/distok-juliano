import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { formatBRL } from '../../lib/format';
import { IconPlus, IconSearch, IconClose, IconArrowUp } from '../../components/ui/icons';

type Customer = { id: string; name: string };
type Product  = { id: string; name: string; sku: string | null; unit: string; sale_price: number };
type CartItem = { productId: string; productName: string; unit: string; quantity: number; unitPrice: number; discount: number };
type Payment  = { method: string; amount: number; received_amount: number | null; change_amount: number | null };
type Sale     = { id: string; number: number; status: string; total: number; subtotal: number; discount: number; payment_method: string; sold_at: string; customer_name: string | null; user_name: string | null };
type Page     = { items: Sale[]; total: number; page: number; pages: number };

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' }, { value: 'pix', label: 'Pix' },
  { value: 'cartao_debito', label: 'Cartão de Débito' }, { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'boleto', label: 'Boleto' }, { value: 'cheque', label: 'Cheque' },
];
const STATUS_BADGE: Record<string, string> = { open: 'badge-success', cancelled: 'badge-neutral' };
const STATUS_LABEL: Record<string, string> = { open: 'Concluída', cancelled: 'Cancelada' };

function paymentLabel(method: string) {
  if (method === 'multiplo') return 'Múltiplas formas';
  return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
}

export function SalesPage() {
  const toast   = useToast();
  const confirm = useConfirm();
  const location = useLocation();
  const [page, setPage]               = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(true);
  const [detail, setDetail]           = useState<any | null>(null);
  const [newOpen, setNewOpen]         = useState(false);

  useEffect(() => {
    if ((location.state as any)?.autoOpen === 'new') setNewOpen(true);
  }, []); // eslint-disable-line

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
    const ok = await confirm({ title: `Cancelar venda #${num}?`, message: 'O estoque dos itens será devolvido. Esta ação não pode ser desfeita.', confirmText: 'Cancelar venda', danger: true });
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
      <PageHeader title="Vendas" subtitle="Registre vendas e a baixa de estoque é feita automaticamente"
        actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><IconPlus width={16} height={16} /> Nova venda</button>}
      />

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconArrowUp />} title="Nenhuma venda registrada" hint='Clique em "Nova venda" para começar.'
            action={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><IconPlus width={16} height={16} /> Nova venda</button>}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Cliente</th><th>Pagamento</th><th>Total</th><th>Data</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s.id)}>
                  <td style={{ fontWeight: 700 }}>#{s.number}</td>
                  <td>{s.customer_name || <span className="muted">Avulsa</span>}</td>
                  <td className="muted">{paymentLabel(s.payment_method)}</td>
                  <td style={{ fontWeight: 600 }}>{formatBRL(Number(s.total))}</td>
                  <td className="muted">{new Date(s.sold_at).toLocaleDateString('pt-BR')}</td>
                  <td><span className={`badge ${STATUS_BADGE[s.status]}`}>{STATUS_LABEL[s.status]}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {s.status === 'open' && <button className="btn btn-sm" onClick={() => doCancel(s.id, s.number)}>Cancelar</button>}
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

      {/* Modal detalhe */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `Venda #${detail.number}` : ''}
        subtitle={detail ? STATUS_LABEL[detail.status] : undefined}
        size="lg"
        footer={detail?.status === 'open' ? (
          <button className="btn" onClick={() => doCancel(detail.id, detail.number)}>Cancelar venda</button>
        ) : undefined}
      >
        {detail && (
          <>
            <div className="grid-2" style={{ marginBottom: 'var(--sp-5)' }}>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Cliente</div><div>{detail.customer_name || '—'}</div></div>
              <div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Pagamento</div>
                {(detail.payments && detail.payments.length > 0 ? detail.payments : [{ method: detail.payment_method, amount: detail.total, change_amount: null }]).map((p: Payment, i: number) => (
                  <div key={i}>
                    {paymentLabel(p.method)} — {formatBRL(Number(p.amount))}
                    {Number(p.change_amount) > 0 && <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}> (troco {formatBRL(Number(p.change_amount))})</span>}
                  </div>
                ))}
              </div>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Data</div><div>{new Date(detail.sold_at).toLocaleDateString('pt-BR')}</div></div>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Responsável</div><div>{detail.user_name || '—'}</div></div>
            </div>
            <div className="table-wrap" style={{ marginBottom: 'var(--sp-4)' }}>
              <table className="table">
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
            </div>
            <div style={{ textAlign: 'right' }}>
              {Number(detail.discount) > 0 && <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Desconto: {formatBRL(Number(detail.discount))}</div>}
              <div style={{ fontWeight: 700, fontSize: 'var(--fs-xl)' }}>{formatBRL(Number(detail.total))}</div>
            </div>
          </>
        )}
      </Modal>

      {/* Modal nova venda */}
      <SaleFormModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); load(1); setCurrentPage(1); }} />
    </div>
  );
}

// ─── Modal Nova Venda ─────────────────────────────────────────────────────────

type PaymentLine = { method: string; amount: number; receivedAmount?: number };

function SaleFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [customers, setCustomers]       = useState<Customer[]>([]);
  const [customerId, setCustomerId]     = useState('');
  const [payments, setPayments]         = useState<PaymentLine[]>([{ method: 'dinheiro', amount: 0 }]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [notes, setNotes]               = useState('');
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    if (!open) { setCustomerId(''); setPayments([{ method: 'dinheiro', amount: 0 }]); setGlobalDiscount(0); setNotes(''); setCart([]); setProductQuery(''); setProductResults([]); return; }
    api.get('/customers', { params: { status: 'active', page: 1 } }).then(({ data }) => setCustomers(data.items)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (productQuery.length < 1) { setProductResults([]); return; }
    const h = setTimeout(() => {
      api.get('/products', { params: { search: productQuery, status: 'active' } }).then(({ data }) => setProductResults(data.slice(0, 6))).catch(() => {});
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

  /** Leitor de código de barras: Enter num código exato (SKU) adiciona direto ao carrinho, sem precisar clicar. */
  async function handleScanEnter() {
    const q = productQuery.trim();
    if (!q) return;
    let match = productResults.find((p) => p.sku && p.sku.toLowerCase() === q.toLowerCase());
    if (!match) {
      try {
        const { data } = await api.get('/products', { params: { search: q, status: 'active' } });
        match = data.find((p: Product) => p.sku && p.sku.toLowerCase() === q.toLowerCase()) || (data.length === 1 ? data[0] : undefined);
      } catch { /* ignore */ }
    }
    if (match) addProduct(match);
    else toast.push('Nenhum produto encontrado para esse código.', 'error');
  }

  function updateCart(idx: number, field: keyof CartItem, val: number) {
    setCart((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice - i.discount, 0);
  const total    = Math.max(0, subtotal - globalDiscount);

  // Com uma única forma de pagamento, o valor acompanha o total automaticamente.
  useEffect(() => {
    setPayments((prev) => prev.length === 1 ? [{ ...prev[0], amount: total }] : prev);
  }, [total]);

  const paymentsTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paymentsDiff  = Math.round((total - paymentsTotal) * 100) / 100;

  function addPaymentLine() {
    setPayments((prev) => [...prev, { method: 'dinheiro', amount: Math.max(0, paymentsDiff) }]);
  }
  function removePaymentLine(idx: number) {
    setPayments((prev) => prev.filter((_, i) => i !== idx));
  }
  function updatePayment(idx: number, patch: Partial<PaymentLine>) {
    setPayments((prev) => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  }

  async function save() {
    if (cart.length === 0) return toast.push('Adicione ao menos um produto.', 'error');
    if (Math.abs(paymentsDiff) > 0.009) return toast.push('A soma dos pagamentos deve ser igual ao total da venda.', 'error');
    for (const p of payments) {
      if (p.method === 'dinheiro' && p.receivedAmount != null && p.receivedAmount < p.amount) {
        return toast.push('Valor recebido não pode ser menor que o valor da forma de pagamento.', 'error');
      }
    }
    setSaving(true);
    try {
      await api.post('/sales', {
        customerId: customerId || undefined,
        payments: payments.map((p) => ({ method: p.method, amount: p.amount, receivedAmount: p.method === 'dinheiro' ? p.receivedAmount : undefined })),
        notes:      notes || undefined,
        discount:   globalDiscount,
        items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount })),
      });
      toast.push('Venda registrada e estoque atualizado!', 'success');
      onSaved();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível registrar a venda.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova venda" size="xl"
      footer={
        <>
          <button className="btn btn-primary" onClick={save} disabled={saving || cart.length === 0}>{saving ? 'Registrando…' : 'Finalizar venda'}</button>
          <button className="btn" onClick={onClose}>Cancelar</button>
          {cart.length > 0 && (
            <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 'var(--fs-lg)' }}>{formatBRL(total)}</span>
          )}
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel>Cliente</FieldLabel>
          <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Sem cliente (avulsa)</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel hint="Desconto sobre o total geral.">Desconto geral</FieldLabel>
          <MoneyInput value={globalDiscount} onChange={setGlobalDiscount} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel>Observações</FieldLabel>
          <input className="input" placeholder="Ex.: entrega amanhã…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
        <FieldLabel hint="Digite para buscar ou use um leitor de código de barras — Enter adiciona direto ao carrinho.">Adicionar produto</FieldLabel>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome ou escanear código de barras"
            value={productQuery} autoFocus onChange={(e) => setProductQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleScanEnter(); } }} />
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
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Produto</th><th>Qtd</th><th>Preço unit.</th><th>Desconto</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {cart.map((it, idx) => {
                  const itTotal = it.quantity * it.unitPrice - it.discount;
                  return (
                    <tr key={it.productId}>
                      <td style={{ fontWeight: 500 }}>{it.productName} <span className="muted" style={{ fontWeight: 400 }}>({it.unit})</span></td>
                      <td style={{ width: 100 }}>
                        <input className="input" type="number" min={1} value={it.quantity} style={{ textAlign: 'center' }}
                          onChange={(e) => updateCart(idx, 'quantity', Number(e.target.value))} />
                      </td>
                      <td style={{ width: 140 }}><MoneyInput value={it.unitPrice} onChange={(v) => updateCart(idx, 'unitPrice', v)} /></td>
                      <td style={{ width: 130 }}><MoneyInput value={it.discount}  onChange={(v) => updateCart(idx, 'discount', v)}  /></td>
                      <td style={{ fontWeight: 600 }}>{formatBRL(Math.max(0, itTotal))}</td>
                      <td style={{ width: 40 }}>
                        <button className="btn btn-sm btn-ghost" aria-label="Remover do carrinho" onClick={() => setCart((c) => c.filter((_, i) => i !== idx))}><IconClose width={15} height={15} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'right', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-3)', marginTop: 'var(--sp-3)' }}>
            <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Subtotal: {formatBRL(subtotal)}</div>
            {globalDiscount > 0 && <div className="muted" style={{ fontSize: 'var(--fs-sm)' }}>Desconto: -{formatBRL(globalDiscount)}</div>}
          </div>

          <div style={{ marginTop: 'var(--sp-5)', borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)' }}>
            <FieldLabel required>Pagamento</FieldLabel>
            {payments.map((p, idx) => {
              const change = p.method === 'dinheiro' && p.receivedAmount != null ? p.receivedAmount - p.amount : null;
              return (
                <div key={idx} style={{ marginBottom: 'var(--sp-3)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: p.method === 'dinheiro' ? '1fr 130px 130px 32px' : '1fr 130px 32px', gap: 'var(--sp-3)' }}>
                    <select className="input" value={p.method} onChange={(e) => updatePayment(idx, { method: e.target.value, receivedAmount: undefined })}>
                      {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <MoneyInput value={p.amount} onChange={(v) => updatePayment(idx, { amount: v })} />
                    {p.method === 'dinheiro' && (
                      <MoneyInput value={p.receivedAmount ?? p.amount} onChange={(v) => updatePayment(idx, { receivedAmount: v })} />
                    )}
                    {payments.length > 1 ? (
                      <button className="btn btn-sm btn-ghost" aria-label="Remover forma de pagamento" onClick={() => removePaymentLine(idx)}><IconClose width={15} height={15} /></button>
                    ) : <span />}
                  </div>
                  {change != null && change > 0 && (
                    <div className="muted" style={{ fontSize: 'var(--fs-sm)', marginTop: 4 }}>
                      Troco: <strong style={{ color: 'var(--color-success)' }}>{formatBRL(change)}</strong>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-sm" onClick={addPaymentLine} disabled={paymentsDiff <= 0}>+ Adicionar outra forma de pagamento</button>
              {Math.abs(paymentsDiff) > 0.009 && (
                <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-danger)' }}>
                  {paymentsDiff > 0 ? `Faltam ${formatBRL(paymentsDiff)}` : `Excede em ${formatBRL(-paymentsDiff)}`}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
