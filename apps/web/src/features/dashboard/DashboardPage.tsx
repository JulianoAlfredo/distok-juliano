import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, Loading, EmptyState } from '../../components/ui';
import { IconBox, IconAlert, IconLayers, IconArrowUp, IconArrowDown } from '../../components/ui/icons';

type Summary = {
  productsActive: number;
  belowMin: number;
  stockValue: number;
  lastMovements: any[];
  entriesVsExits: { day: string; type: string; total: number }[];
};

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
      <PageHeader title="Dashboard" subtitle="Visão geral do seu estoque em tempo real" />

      <div className="stat-grid">
        <Stat label={`${t('product')}s ativos`} value={String(s.productsActive)} icon={<IconBox />} />
        <Stat label="Abaixo do mínimo" value={String(s.belowMin)} icon={<IconAlert />} danger={s.belowMin > 0} />
        <Stat label="Valor em estoque" value={brl(s.stockValue)} icon={<IconLayers />} />
        <Stat label="Movimentado (7 dias)" value={String(moved)} icon={<IconArrowUp />} />
      </div>

      <div className="card mt-6" style={{ padding: 0 }}>
        <div className="row-between" style={{ padding: 'var(--sp-5) var(--sp-6)' }}>
          <h3>Últimas movimentações</h3>
        </div>
        {s.lastMovements.length === 0 ? (
          <EmptyState icon={<IconLayers />} title="Sem movimentações ainda" hint="As entradas e saídas aparecerão aqui." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr><th>Data</th><th>Produto</th><th>Tipo</th><th>Qtd</th><th>Saldo</th><th>Responsável</th></tr>
              </thead>
              <tbody>
                {s.lastMovements.map((m, i) => (
                  <tr key={i}>
                    <td className="muted">{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                    <td style={{ fontWeight: 500 }}>{m.product || '—'}</td>
                    <td><MovType type={m.type} /></td>
                    <td>{m.quantity}</td>
                    <td style={{ fontWeight: 600 }}>{m.balance_after}</td>
                    <td className="muted">{m.user_name || '—'}</td>
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

function Stat({ label, value, icon, danger }: { label: string; value: string; icon: React.ReactNode; danger?: boolean }) {
  return (
    <div className="stat">
      <div className="row-between">
        <span className="stat-label">{label}</span>
        <span className="stat-ico" style={danger ? { background: 'var(--color-danger-soft)', color: 'var(--color-danger)' } : undefined}>{icon}</span>
      </div>
      <div className="stat-value" style={danger ? { color: 'var(--color-danger)' } : undefined}>{value}</div>
    </div>
  );
}

function MovType({ type }: { type: string }) {
  if (type === 'entry') return <span className="badge badge-success"><IconArrowUp width={12} height={12} /> Entrada</span>;
  if (type === 'exit') return <span className="badge badge-danger"><IconArrowDown width={12} height={12} /> Saída</span>;
  return <span className="badge badge-info">Ajuste</span>;
}
