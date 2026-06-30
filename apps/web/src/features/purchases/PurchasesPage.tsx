import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { formatBRL } from '../../lib/format';
import { IconPlus, IconSearch, IconClose, IconCheck } from '../../components/ui/icons';

type Supplier  = { id: string; name: string };
type Product   = { id: string; name: string; sku: string | null; unit: string; cost_price: number };
type PurchaseItem = { productId: string; productName: string; unit: string; quantity: number; unitCost: number };
type Purchase  = {
  id: string; number: number; status: string; total_cost: number;
  purchased_at: string; supplier_name: string | null; user_name: string | null; notes: string | null;
};
type Page = { items: Purchase[]; total: number; page: number; pages: number };

const STATUS_LABEL: Record<string, string>    = { draft: 'Rascunho', confirmed: 'Confirmado', cancelled: 'Cancelado' };
const STATUS_BADGE: Record<string, string>    = { draft: 'badge-warning', confirmed: 'badge-success', cancelled: 'badge-neutral' };

export function PurchasesPage() {
  const [tab, setTab] = useState<'list' | 'new'>('list');
  return (
    <div>
      <PageHeader title="Compras" subtitle="Pedidos de compra de produtos e atualização automática do estoque" />
      <div className="seg" style={{ marginBottom: 'var(--sp-5)' }}>
        <button className={`seg-btn${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>Pedidos</button>
        <button className={`seg-btn${tab === 'new'  ? ' active' : ''}`} onClick={() => setTab('new')}>Novo pedido</button>
      </div>
      {tab === 'list' ? <PurchaseList onNew={() => setTab('new')} /> : <PurchaseForm onSaved={() => setTab('list')} />}
    </div>
  );
}

// ─── Lista de Pedidos ─────────────────────────────────────────────────────────

function PurchaseList({ onNew }: { onNew: () => void }) {
  const toast   = useToast();
  const confirm = useConfirm();
  const [page, setPage]               = useState<Page>({ items: [], total: 0, page: 1, pages: 1 });
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage]   = useState(1);
  const [loading, setLoading]           = useState(true);
  const [detail, setDetail]             = useState<any | null>(null);

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
    const ok = await confirm({ title: `Confirmar pedido #${num}?`, message: 'O estoque será atualizado imediatamente e o custo médio dos produtos será recalculado. Esta ação não pode ser desfeita.', confirmText: 'Confirmar pedido' });
    if (!ok) return;
    try {
      await api.patch(`/purchases/${id}/confirm`);
      toast.push('Pedido confirmado e estoque atualizado!', 'success');
      setDetail(null); load();
    } catch (e: any) { toast.push(e.response?.data?.error?.message || 'Erro ao confirmar.', 'error'); }
  }

  async function doCancel(id: string, num: number) {
    const ok = await confirm({ title: `Cancelar pedido #${num}?`, message: 'O pedido será marcado como cancelado e o estoque NÃO será alterado.', confirmText: 'Cancelar pedido', danger: true });
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
      <div className="row" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div className="seg">
          <button className={`seg-btn${statusFilter === ''          ? ' active' : ''}`} onClick={() => setStatusFilter('')}>Todos</button>
          <button className={`seg-btn${statusFilter === 'draft'     ? ' active' : ''}`} onClick={() => setStatusFilter('draft')}>Rascunho</button>
          <button className={`seg-btn${statusFilter === 'confirmed' ? ' active' : ''}`} onClick={() => setStatusFilter('confirmed')}>Confirmados</button>
          <button className={`seg-btn${statusFilter === 'cancelled' ? ' active' : ''}`} onClick={() => setStatusFilter('cancelled')}>Cancelados</button>
        </div>
        <button className="btn btn-primary" onClick={onNew}><IconPlus width={16} height={16} /> Novo pedido</button>
      </div>

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconSearch />} title="Nenhum pedido encontrado" hint='Clique em "Novo pedido" para criar.' action={<button className="btn btn-primary" onClick={onNew}><IconPlus width={16} height={16} /> Novo pedido</button>} /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Fornecedor</th><th>Total</th><th>Data</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(p.id)}>
                  <td style={{ fontWeight: 700 }}>#{p.number}</td>
                  <td>{p.supplier_name || <span className="muted">Sem fornecedor</span>}</td>
                  <td style={{ fontWeight: 600 }}>{formatBRL(Number(p.total_cost))}</td>
                  <td className="muted">{new Date(p.purchased_at).toLocaleDateString('pt-BR')}</td>
                  <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {p.status === 'draft' && (
                      <div className="row" style={{ gap: 'var(--sp-2)' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => doConfirm(p.id, p.number)}><IconCheck width={14} height={14} /> Confirmar</button>
                        <button className="btn btn-sm"             onClick={() => doCancel(p.id, p.number)}>Cancelar</button>
                      </div>
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
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)', zIndex: 100 }}>
          <div className="card" style={{ width: 680, maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', padding: 0 }} onClick={(e) => e.stopPropagation()}>
            <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
              <div>
                <h3>Pedido #{detail.number}</h3>
                <span className={`badge ${STATUS_BADGE[detail.status]}`}>{STATUS_LABEL[detail.status]}</span>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}><IconClose width={18} height={18} /></button>
            </div>
            <div style={{ padding: 'var(--sp-5) var(--sp-6)' }}>
              <div className="grid-2" style={{ marginBottom: 'var(--sp-4)' }}>
                <div><span className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Fornecedor</span><div>{detail.supplier_name || '—'}</div></div>
                <div><span className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Data</span><div>{new Date(detail.purchased_at).toLocaleDateString('pt-BR')}</div></div>
                <div><span className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Responsável</span><div>{detail.user_name || '—'}</div></div>
                <div><span className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, textTransform: 'uppercase' }}>Total</span><div style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>{formatBRL(Number(detail.total_cost))}</div></div>
              </div>
              {detail.notes && <p className="muted" style={{ marginBottom: 'var(--sp-4)' }}>{detail.notes}</p>}
              <table className="table" style={{ marginBottom: 'var(--sp-4)' }}>
                <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th><th>Total</th></tr></thead>
                <tbody>
                  {detail.items.map((it: any) => (
                    <tr key={it.id}>
                      <td>{it.product_name}</td>
                      <td>{it.quantity} {it.unit}</td>
                      <td>{formatBRL(Number(it.unit_cost))}</td>
                      <td style={{ fontWeight: 600 }}>{formatBRL(Number(it.total_cost))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.status === 'draft' && (
                <div className="row">
                  <button className="btn btn-primary" onClick={() => doConfirm(detail.id, detail.number)}><IconCheck width={16} height={16} /> Confirmar e atualizar estoque</button>
                  <button className="btn" onClick={() => doCancel(detail.id, detail.number)}>Cancelar pedido</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Formulário de Novo Pedido ────────────────────────────────────────────────

function PurchaseForm({ onSaved }: { onSaved: () => void }) {
  const toast    = useToast();
  const [suppliers, setSuppliers]   = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes]           = useState('');
  const [items, setItems]           = useState<PurchaseItem[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    api.get('/suppliers', { params: { status: 'active', page: 1 } })
      .then(({ data }) => setSuppliers(data.items))
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
    if (items.find((i) => i.productId === p.id)) return;
    setItems((prev) => [...prev, { productId: p.id, productName: p.name, unit: p.unit, quantity: 1, unitCost: Number(p.cost_price) }]);
  }

  function updateItem(idx: number, field: 'quantity' | 'unitCost', val: number) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  async function save() {
    if (items.length === 0) return toast.push('Adicione ao menos um produto.', 'error');
    setSaving(true);
    try {
      await api.post('/purchases', {
        supplierId: supplierId || undefined,
        notes: notes || undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitCost: i.unitCost })),
      });
      toast.push('Pedido criado como rascunho! Confirme na lista para atualizar o estoque.', 'success');
      onSaved();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar o pedido.', 'error');
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Informações do pedido</h3>
        <div className="grid-2">
          <div className="field" style={{ margin: 0 }}>
            <FieldLabel>Fornecedor</FieldLabel>
            <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">Sem fornecedor</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
            <FieldLabel>Observações</FieldLabel>
            <input className="input" placeholder="Ex.: NF 1234, entrega em 5 dias…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <h3 style={{ marginBottom: 'var(--sp-4)' }}>Itens do pedido</h3>

        {/* Busca produto */}
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
                    <span className="muted" style={{ float: 'right', fontSize: 'var(--fs-xs)' }}>{formatBRL(Number(p.cost_price))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tabela de itens */}
        {items.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 'var(--sp-6) 0', fontSize: 'var(--fs-sm)' }}>
            Nenhum item adicionado ainda
          </p>
        ) : (
          <div className="table-wrap" style={{ marginBottom: 'var(--sp-4)' }}>
            <table className="table">
              <thead><tr><th>Produto</th><th>Qtd</th><th>Custo unit.</th><th>Total</th><th></th></tr></thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.productId}>
                    <td style={{ fontWeight: 500 }}>{it.productName} <span className="muted" style={{ fontWeight: 400 }}>({it.unit})</span></td>
                    <td style={{ width: 120 }}>
                      <input className="input" type="number" min={1} value={it.quantity} style={{ textAlign: 'center' }}
                        onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))} />
                    </td>
                    <td style={{ width: 160 }}>
                      <MoneyInput value={it.unitCost} onChange={(v) => updateItem(idx, 'unitCost', v)} />
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatBRL(it.quantity * it.unitCost)}</td>
                    <td style={{ width: 40 }}>
                      <button className="btn btn-sm btn-ghost" onClick={() => removeItem(idx)}><IconClose width={15} height={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && (
          <div className="row-between" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--sp-4)' }}>
            <span className="muted">{items.length} produto{items.length !== 1 ? 's' : ''}</span>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>Total: {formatBRL(total)}</span>
          </div>
        )}
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={saving || items.length === 0}>
          {saving ? 'Salvando…' : 'Salvar como rascunho'}
        </button>
        <button className="btn" onClick={onSaved}>Cancelar</button>
      </div>
      <p className="muted mt-2" style={{ fontSize: 'var(--fs-xs)' }}>O pedido é salvo como rascunho. Confirme na lista para atualizar o estoque.</p>
    </div>
  );
}
