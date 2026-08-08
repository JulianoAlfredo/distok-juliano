import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, Loading, EmptyState } from '../../components/ui';
import { IconBox, IconAlert, IconAlertTriangle, IconLayers, IconArrowUp, IconArrowDown, IconWallet, IconTrendUp } from '../../components/ui/icons';
import { formatBRL } from '../../lib/format';

type Summary = {
  productsActive: number; belowMin: number; zeroStock: number; stockValue: number;
  todaySalesTotal: number; todaySalesCount: number;
  monthSalesTotal: number; monthSalesCount: number;
  pendingReceivable: number; pendingPayable: number;
  lastSales: any[]; bestSellers: any[];
  lastMovements: any[];
  entriesVsExits: { day: string; type: string; total: number }[];
};

const PAYMENT: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao_debito: 'Débito', cartao_credito: 'Crédito', boleto: 'Boleto', cheque: 'Cheque' };

export function DashboardPage() {
  const { t } = useTheme();
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/summary').then(({ data }) => { setS(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Carregando dashboard…" />;
  if (!s) return <EmptyState icon={<IconAlert />} title="Não foi possível carregar o dashboard" hint="Tente recarregar a página." />;

  const moved = s.entriesVsExits.reduce((a, x) => a + x.total, 0);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Visão geral em tempo real" />

      <AlertBanner zeroStock={s.zeroStock} belowMin={s.belowMin} />

      {/* Vendas */}
      <h4 className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--sp-3)', letterSpacing: '.06em' }}>Vendas</h4>
      <div className="stat-grid" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label="Vendas hoje"     value={formatBRL(s.todaySalesTotal)}  sub={`${s.todaySalesCount} venda${s.todaySalesCount !== 1 ? 's' : ''}`} icon={<IconTrendUp />} />
        <Stat label="Vendas do mês"   value={formatBRL(s.monthSalesTotal)}  sub={`${s.monthSalesCount} venda${s.monthSalesCount !== 1 ? 's' : ''}`} icon={<IconArrowUp />} />
        <Stat label="A receber"       value={formatBRL(s.pendingReceivable)} icon={<IconWallet />} />
        <Stat label="A pagar"         value={formatBRL(s.pendingPayable)}    icon={<IconArrowDown />} />
      </div>

      {/* Estoque */}
      <h4 className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 'var(--sp-3)', letterSpacing: '.06em' }}>Estoque</h4>
      <div className="stat-grid" style={{ marginBottom: 'var(--sp-6)' }}>
        <Stat label={`${t('product')}s ativos`}  value={String(s.productsActive)} icon={<IconBox />} />
        <Stat label="Abaixo do mínimo" value={String(s.belowMin)}  icon={<IconAlert />} danger={s.belowMin > 0} />
        <Stat label="Sem estoque"      value={String(s.zeroStock)} icon={<IconAlert />} danger={s.zeroStock > 0} />
        <Stat label="Valor em estoque" value={formatBRL(s.stockValue)} icon={<IconLayers />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--sp-5)', marginBottom: 'var(--sp-5)' }}>
        {/* Últimas vendas */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--color-border)' }}><h3>Últimas vendas</h3></div>
          {s.lastSales.length === 0 ? (
            <div style={{ padding: 'var(--sp-5)' }}><EmptyState icon={<IconTrendUp />} title="Nenhuma venda" hint="As vendas aparecerão aqui." /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Pagamento</th><th>Data</th></tr></thead>
                <tbody>
                  {s.lastSales.map((sale) => (
                    <tr key={sale.id}>
                      <td style={{ fontWeight: 700 }} data-label="#">#{sale.number}</td>
                      <td data-label="Cliente">{sale.customer_name || <span className="muted">Avulso</span>}</td>
                      <td style={{ fontWeight: 600 }} data-label="Total">{formatBRL(Number(sale.total))}</td>
                      <td className="muted" data-label="Pagamento">{PAYMENT[sale.payment_method] || sale.payment_method}</td>
                      <td className="muted" data-label="Data">{new Date(sale.sold_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mais vendidos */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--color-border)' }}><h3>Mais vendidos (30 dias)</h3></div>
          {s.bestSellers.length === 0 ? (
            <div style={{ padding: 'var(--sp-5)' }}><EmptyState icon={<IconBox />} title="Sem dados" hint="Produtos mais vendidos aparecerão aqui." /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead><tr><th>Produto</th><th>Qtd vendida</th><th>Receita</th></tr></thead>
                <tbody>
                  {s.bestSellers.map((b, i) => (
                    <tr key={b.id}>
                      <td data-label="Produto"><span className="muted" style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, marginRight: 'var(--sp-2)' }}>#{i + 1}</span>{b.name}</td>
                      <td style={{ fontWeight: 600 }} data-label="Qtd vendida">{b.qty_sold}</td>
                      <td data-label="Receita">{formatBRL(b.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Últimas movimentações */}
      <div className="card" style={{ padding: 0 }}>
        <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)' }}>
          <h3>Últimas movimentações</h3>
          <span className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{moved} unidades movimentadas (7 dias)</span>
        </div>
        {s.lastMovements.length === 0 ? (
          <EmptyState icon={<IconLayers />} title="Sem movimentações ainda" hint="As entradas e saídas aparecerão aqui." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Responsável</th></tr></thead>
              <tbody>
                {s.lastMovements.map((m, i) => (
                  <tr key={i}>
                    <td className="muted" data-label="Data">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                    <td style={{ fontWeight: 500 }} data-label="Produto">{m.product || '—'}</td>
                    <td data-label="Tipo"><MovType type={m.type} /></td>
                    <td data-label="Qtd">{m.quantity}</td>
                    <td style={{ fontWeight: 600 }} data-label="Saldo">{m.balance_after}</td>
                    <td className="muted" data-label="Responsável">{m.user_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AlertBanner({ zeroStock, belowMin }: { zeroStock: number; belowMin: number }) {
  const navigate = useNavigate();
  if (zeroStock === 0 && belowMin === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
      {zeroStock > 0 && (
        <div className="alert-banner alert-banner-error">
          <IconAlert width={16} height={16} style={{ flex: 'none' }} />
          <span><strong>{zeroStock} produto{zeroStock > 1 ? 's' : ''} sem estoque.</strong> Reposição necessária.</span>
          <button className="btn btn-xs btn-ghost alert-banner-action" onClick={() => navigate('/estoque')}>Ver estoque</button>
        </div>
      )}
      {belowMin > 0 && (
        <div className="alert-banner alert-banner-warning">
          <IconAlertTriangle width={16} height={16} style={{ flex: 'none' }} />
          <span><strong>{belowMin} produto{belowMin > 1 ? 's' : ''} abaixo do estoque mínimo.</strong> Considere repor.</span>
          <button className="btn btn-xs btn-ghost alert-banner-action" onClick={() => navigate('/estoque')}>Ver estoque</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, icon, danger }: { label: string; value: string; sub?: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className="stat">
      <div className="row-between">
        <span className="stat-label">{label}</span>
        <span className="stat-ico" style={danger ? { background: 'var(--color-danger-soft)', color: 'var(--color-danger)' } : undefined}>{icon}</span>
      </div>
      <div className="stat-value" style={danger ? { color: 'var(--color-danger)' } : undefined}>{value}</div>
      {sub && <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function MovType({ type }: { type: string }) {
  if (type === 'entry') return <span className="badge badge-success"><IconArrowUp width={12} height={12} /> Entrada</span>;
  if (type === 'exit') return <span className="badge badge-danger"><IconArrowDown width={12} height={12} /> Saída</span>;
  return <span className="badge badge-info">Ajuste</span>;
}
