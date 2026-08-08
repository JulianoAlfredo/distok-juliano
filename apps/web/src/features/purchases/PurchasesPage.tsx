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
import { IconPlus, IconSearch, IconClose, IconCheck, IconBox } from '../../components/ui/icons';

type Supplier     = { id: string; name: string };
type Product      = { id: string; name: string; sku: string | null; unit: string; cost_price: number };
type PurchaseItem = { productId: string; productName: string; unit: string; quantity: number; unitCost: number };
type Purchase     = { id: string; number: number; status: string; total_cost: number; purchased_at: string; supplier_name: string | null; user_name: string | null; notes: string | null };
type Page         = { items: Purchase[]; total: number; page: number; pages: number };

const STATUS_LABEL: Record<string, string> = { draft: 'Rascunho', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_BADGE: Record<string, string> = { draft: 'badge-warning', confirmed: 'badge-success', cancelled: 'badge-neutral' };

export function PurchasesPage() {
  const toast   = useToast();
  const confirm = useConfirm();
  const [page, setPage]               = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading]         = useState(true);
  const [detail, setDetail]           = useState<any | null>(null);
  const [newOpen, setNewOpen]         = useState(false);
  const location = useLocation();
  useEffect(() => { if ((location.state as any)?.autoOpen === 'new') setNewOpen(true); }, []); // eslint-disable-line

  async function load(p = currentPage) {
    setLoading(true);
    try {
      const { data } = await api.get('/purchases', { params: { status: statusFilter || undefined, page: p } });
      setPage(data);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(1); setCurrentPage(1); /* eslint-disable-next-line */ }, [statusFilter]);
  useEffect(() => { load(currentPage); /* eslint-disable-next-line */ }, [currentPage]);

  async function openDetail(id: string) {
    const { data } = await api.get(`/purchases/${id}`);
    setDetail(data);
  }

  async function doConfirm(id: string, num: number) {
    const ok = await confirm({ title: `Confirmar pedido #${num}?`, message: 'O estoque será atualizado imediatamente e o custo médio recalculado. Esta ação não pode ser desfeita.', confirmText: 'Confirmar pedido' });
    if (!ok) return;
    try {
      await api.patch(`/purchases/${id}/confirm`);
      toast.push('Pedido confirmado e estoque atualizado!', 'success');
      setDetail(null); load();
    } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao confirmar.', 'error'); }
  }

  async function doCancel(id: string, num: number, status: string) {
    const message = status === 'confirmed'
      ? 'O pedido será cancelado e a entrada de estoque que ele gerou será estornada (saída equivalente). Isso falha se o produto já foi parcialmente vendido/movimentado desde a confirmação.'
      : 'O pedido será marcado como cancelado. Como ainda é rascunho, o estoque não foi alterado.';
    const ok = await confirm({ title: `Cancelar pedido #${num}?`, message, confirmText: 'Cancelar pedido', danger: true });
    if (!ok) return;
    try {
      await api.patch(`/purchases/${id}/cancel`);
      toast.push('Pedido cancelado.', 'success');
      setDetail(null); load();
    } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao cancelar.', 'error'); }
  }

  const { items, total, pages } = page;

  return (
    <div>
      <PageHeader title="Compras" subtitle="Pedidos de compra e atualização automática do estoque"
        actions={<button className="btn btn-primary" onClick={() => setNewOpen(true)}><IconPlus width={16} height={16} /> Novo pedido</button>}
      />

      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${statusFilter === ''          ? ' active' : ''}`} onClick={() => setStatusFilter('')}>Todos</button>
        <button className={`seg-btn${statusFilter === 'draft'     ? ' active' : ''}`} onClick={() => setStatusFilter('draft')}>Rascunho</button>
        <button className={`seg-btn${statusFilter === 'confirmed' ? ' active' : ''}`} onClick={() => setStatusFilter('confirmed')}>Confirmados</button>
        <button className={`seg-btn${statusFilter === 'cancelled' ? ' active' : ''}`} onClick={() => setStatusFilter('cancelled')}>Cancelados</button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card">
          <EmptyState icon={<IconBox />} title="Nenhum pedido encontrado"
            hint={statusFilter ? 'Ajuste o filtro.' : 'Clique em "Novo pedido" para criar o primeiro.'}
            action={!statusFilter && <button className="btn btn-primary" onClick={() => setNewOpen(true)}><IconPlus width={16} height={16} /> Novo pedido</button>}
          />
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Fornecedor</th><th>Total</th><th>Data</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p.id)}>
                  <td style={{ fontWeight: 700 }} data-label="#">#{p.number}</td>
                  <td data-label="Fornecedor">{p.supplier_name || <span className="muted">Sem fornecedor</span>}</td>
                  <td style={{ fontWeight: 600 }} data-label="Total">{formatBRL(Number(p.total_cost))}</td>
                  <td className="muted" data-label="Data">{new Date(p.purchased_at).toLocaleDateString('pt-BR')}</td>
                  <td data-label="Situação"><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {p.status === 'draft' && (
                      <div className="row" style={{ gap: 'var(--sp-2)' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => doConfirm(p.id, p.number)}><IconCheck width={14} height={14} /> Confirmar</button>
                        <button className="btn btn-sm" onClick={() => doCancel(p.id, p.number, p.status)}>Cancelar</button>
                      </div>
                    )}
                    {p.status === 'confirmed' && (
                      <button className="btn btn-sm" onClick={() => doCancel(p.id, p.number, p.status)}>Estornar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination">
            <span className="pagination-info">{total} pedido{total !== 1 ? 's' : ''} — página {currentPage} de {pages}</span>
            <button className="btn btn-sm" disabled={currentPage <= 1}    onClick={() => setCurrentPage((p) => p - 1)}>← Anterior</button>
            <button className="btn btn-sm" disabled={currentPage >= pages} onClick={() => setCurrentPage((p) => p + 1)}>Próxima →</button>
          </div>
        </div>
      )}

      {/* Modal detalhe */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `Pedido #${detail.number}` : ''}
        subtitle={detail ? STATUS_LABEL[detail.status] : undefined}
        size="lg"
        footer={detail?.status === 'draft' ? (
          <>
            <button className="btn btn-primary" onClick={() => doConfirm(detail.id, detail.number)}><IconCheck width={16} height={16} /> Confirmar e atualizar estoque</button>
            <button className="btn" onClick={() => doCancel(detail.id, detail.number, detail.status)}>Cancelar pedido</button>
          </>
        ) : detail?.status === 'confirmed' ? (
          <button className="btn" onClick={() => doCancel(detail.id, detail.number, detail.status)}>Estornar pedido</button>
        ) : undefined}
      >
        {detail && (
          <>
            <div className="grid-2" style={{ marginBottom: 'var(--sp-5)' }}>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Fornecedor</div><div>{detail.supplier_name || '—'}</div></div>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Data</div><div>{new Date(detail.purchased_at).toLocaleDateString('pt-BR')}</div></div>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Responsável</div><div>{detail.user_name || '—'}</div></div>
              <div><div className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Total</div><div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>{formatBRL(Number(detail.total_cost))}</div></div>
            </div>
            {detail.notes && <p className="muted" style={{ marginBottom: 'var(--sp-4)' }}>{detail.notes}</p>}
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th><th>Total</th></tr></thead>
                <tbody>
                  {detail.items.map((it: any) => (
                    <tr key={it.id}>
                      <td data-label="Produto">{it.product_name}</td>
                      <td data-label="Qtd">{it.quantity} {it.unit}</td>
                      <td data-label="Custo unit.">{formatBRL(Number(it.unit_cost))}</td>
                      <td style={{ fontWeight: 600 }} data-label="Total">{formatBRL(Number(it.total_cost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>

      {/* Modal novo pedido */}
      <PurchaseFormModal open={newOpen} onClose={() => setNewOpen(false)} onSaved={() => { setNewOpen(false); load(1); setCurrentPage(1); }} />
    </div>
  );
}

// ─── Modal Novo Pedido ────────────────────────────────────────────────────────

function PurchaseFormModal({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [suppliers, setSuppliers]       = useState<Supplier[]>([]);
  const [supplierId, setSupplierId]     = useState('');
  const [notes, setNotes]               = useState('');
  const [items, setItems]               = useState<PurchaseItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    if (!open) { setSupplierId(''); setNotes(''); setItems([]); setProductQuery(''); setProductResults([]); return; }
    api.get('/suppliers', { params: { status: 'active', page: 1 } }).then(({ data }) => setSuppliers(data.items)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (productQuery.length < 1) { setProductResults([]); return; }
    const h = setTimeout(() => {
      api.get('/products', { params: { search: productQuery, status: 'active' } }).then(({ data }) => setProductResults((data.items ?? data).slice(0, 6))).catch(() => {});
    }, 250);
    return () => clearTimeout(h);
  }, [productQuery]);

  function addProduct(p: Product) {
    setProductQuery(''); setProductResults([]);
    if (items.find((i) => i.productId === p.id)) return;
    setItems((prev) => [...prev, { productId: p.id, productName: p.name, unit: p.unit, quantity: 1, unitCost: Number(p.cost_price) }]);
  }

  function updateItem(idx: number, field: 'quantity' | 'unitCost', val: number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  async function save() {
    if (items.length === 0) return toast.push('Adicione ao menos um produto.', 'error');
    setSaving(true);
    try {
      await api.post('/purchases', {
        supplierId: supplierId || undefined,
        notes:      notes || undefined,
        items:      items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      toast.push('Pedido criado como rascunho! Confirme na lista para atualizar o estoque.', 'success');
      onSaved();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar o pedido.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo pedido de compra" subtitle="Salvo como rascunho. Confirme na lista para atualizar o estoque." size="xl"
      footer={
        <>
          <button className="btn btn-primary" onClick={save} disabled={saving || items.length === 0}>{saving ? 'Salvando…' : 'Salvar rascunho'}</button>
          <button className="btn" onClick={onClose}>Cancelar</button>
          {items.length > 0 && <span style={{ marginLeft: 'auto', fontWeight: 700 }}>Total: {formatBRL(total)}</span>}
        </>
      }
    >
      <div className="grid-2" style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel>Fornecedor</FieldLabel>
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Sem fornecedor</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <FieldLabel>Observações</FieldLabel>
          <input className="input" placeholder="Ex.: NF 1234, entrega em 5 dias…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="field" style={{ marginBottom: 'var(--sp-4)' }}>
        <FieldLabel>Adicionar produto</FieldLabel>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: 11, color: 'var(--color-text-faint)' }}><IconSearch width={18} height={18} /></span>
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Buscar por nome ou código"
            value={productQuery} autoFocus onChange={(e) => setProductQuery(e.target.value)} />
          {productResults.length > 0 && (
            <div style={{ border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', marginTop: 4, overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
              {productResults.map((p) => (
                <div key={p.id} className="pick-row" onClick={() => addProduct(p)}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  {p.sku && <span className="faint"> · {p.sku}</span>}
                  <span className="muted" style={{ float: 'right', fontSize: 'var(--fs-xs)' }}>{formatBRL(Number(p.cost_price))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: 'var(--sp-6) 0', fontSize: 'var(--fs-sm)' }}>Nenhum item adicionado ainda</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th><th>Total</th><th></th></tr></thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.productId}>
                  <td style={{ fontWeight: 500 }} data-label="Produto">{it.productName} <span className="muted" style={{ fontWeight: 400 }}>({it.unit})</span></td>
                  <td style={{ width: 110 }} data-label="Qtd">
                    <input className="input" type="number" min={1} value={it.quantity} style={{ textAlign: 'center' }}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                  </td>
                  <td style={{ width: 150 }} data-label="Custo unit.">
                    <MoneyInput value={it.unitCost} onChange={(v) => updateItem(idx, 'unitCost', v)} />
                  </td>
                  <td style={{ fontWeight: 600 }} data-label="Total">{formatBRL(it.quantity * it.unitCost)}</td>
                  <td style={{ width: 40 }}>
                    <button className="btn btn-sm btn-ghost" aria-label="Remover item" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}><IconClose width={15} height={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
