import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';

type Summary = {
  productsActive: number;
  belowMin: number;
  stockValue: number;
  lastMovements: any[];
  entriesVsExits: { day: string; type: string; total: number }[];
};

export function DashboardPage() {
  const { t } = useTheme();
  const [s, setS] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/summary').then(({ data }) => { setS(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Carregando dashboard...</div>;
  if (!s) return <div>Não foi possível carregar o dashboard.</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--sp-4)', marginBottom: 'var(--sp-6)' }}>
        <Stat label={`${t('product')}s ativos`} value={String(s.productsActive)} />
        <Stat label="Abaixo do mínimo" value={String(s.belowMin)} danger={s.belowMin > 0} />
        <Stat label="Valor em estoque" value={`R$ ${s.stockValue.toFixed(2)}`} />
        <Stat label="Itens movimentados (7d)" value={String(s.entriesVsExits.reduce((a, x) => a + x.total, 0))} />
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Últimas movimentações</h3>
        {s.lastMovements.length === 0 ? (
          <p style={{ color: 'var(--color-text-mut)' }}>Sem movimentações ainda.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: 8 }}>Data</th><th style={{ padding: 8 }}>Produto</th><th style={{ padding: 8 }}>Tipo</th><th style={{ padding: 8 }}>Qtd</th><th style={{ padding: 8 }}>Saldo</th><th style={{ padding: 8 }}>Quem</th>
            </tr></thead>
            <tbody>
              {s.lastMovements.map((m, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 8 }}>{new Date(m.created_at).toLocaleString('pt-BR')}</td>
                  <td style={{ padding: 8 }}>{m.product || '—'}</td>
                  <td style={{ padding: 8 }}>{m.type === 'entry' ? 'entrada' : m.type === 'exit' ? 'saída' : 'ajuste'}</td>
                  <td style={{ padding: 8 }}>{m.quantity}</td>
                  <td style={{ padding: 8 }}>{m.balance_after}</td>
                  <td style={{ padding: 8 }}>{m.user_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="card" style={{ padding: 'var(--sp-4)' }}>
      <div style={{ color: 'var(--color-text-mut)', fontSize: 'var(--fs-sm)' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700, color: danger ? 'var(--color-danger)' : 'var(--color-text)' }}>{value}</div>
    </div>
  );
}
