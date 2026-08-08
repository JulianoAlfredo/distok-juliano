import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../../api/client';
import { Loading, EmptyState } from '../../../components/ui';
import { IconLayers } from '../../../components/ui/icons';
import { useChartColors } from './chartTheme';
import { MovementsTrendPoint } from '../types';

const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 13,
  boxShadow: 'var(--shadow-sm)',
};

function formatDay(day: string) {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

/** Barras agrupadas entrada x saída x ajuste — /dashboard/trends/movements. */
export function MovementsChart() {
  const [days, setDays] = useState<7 | 30>(7);
  const [series, setSeries] = useState<MovementsTrendPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const colors = useChartColors();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .get('/dashboard/trends/movements', { params: { days } })
      .then(({ data }) => { if (!cancelled) setSeries(data.series); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const hasData = !!series && series.some((p) => p.entry || p.exit || p.adjustment);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="row-between" style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--color-border)' }}>
        <h3>Movimentações</h3>
        <div className="seg">
          <button className={`seg-btn${days === 7 ? ' active' : ''}`} onClick={() => setDays(7)}>7 dias</button>
          <button className={`seg-btn${days === 30 ? ' active' : ''}`} onClick={() => setDays(30)}>30 dias</button>
        </div>
      </div>
      <div style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
        {loading ? <Loading label="Carregando movimentações…" /> : error ? (
          <EmptyState icon={<IconLayers />} title="Não foi possível carregar" hint="Tente novamente em instantes." />
        ) : !hasData ? (
          <EmptyState icon={<IconLayers />} title="Sem movimentações no período" hint="Entradas e saídas aparecerão aqui." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={series!} barCategoryGap="24%" barGap={2}>
              <CartesianGrid vertical={false} stroke={colors.border} strokeWidth={1} />
              <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: colors.textFaint, fontSize: 12 }} axisLine={{ stroke: colors.border }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: colors.textFaint, fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(label: any) => formatDay(label)} cursor={{ fill: colors.border, opacity: 0.3 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar name="Entrada" dataKey="entry" fill={colors.success} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar name="Saída" dataKey="exit" fill={colors.danger} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar name="Ajuste" dataKey="adjustment" fill={colors.warning} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
