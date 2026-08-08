import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../../api/client';
import { Loading, EmptyState } from '../../../components/ui';
import { IconTrendUp } from '../../../components/ui/icons';
import { formatBRL } from '../../../lib/format';
import { useChartColors } from './chartTheme';
import { RevenueTrendPoint } from '../types';

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

/** Receita dos últimos 30 dias — série única, sem legenda (o título já diz o que é). */
export function RevenueChart() {
  const [series, setSeries] = useState<RevenueTrendPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const colors = useChartColors();

  useEffect(() => {
    let cancelled = false;
    api
      .get('/dashboard/trends/revenue', { params: { days: 30 } })
      .then(({ data }) => { if (!cancelled) setSeries(data.series); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const hasData = !!series && series.some((p) => p.total);

  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--color-border)' }}><h3>Receita (30 dias)</h3></div>
      <div style={{ padding: 'var(--sp-4) var(--sp-5)' }}>
        {loading ? <Loading label="Carregando receita…" /> : error ? (
          <EmptyState icon={<IconTrendUp />} title="Não foi possível carregar" hint="Tente novamente em instantes." />
        ) : !hasData ? (
          <EmptyState icon={<IconTrendUp />} title="Sem receita no período" hint="As vendas dos últimos 30 dias aparecerão aqui." />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={series!}>
              <CartesianGrid vertical={false} stroke={colors.border} strokeWidth={1} />
              <XAxis dataKey="day" tickFormatter={formatDay} tick={{ fill: colors.textFaint, fontSize: 12 }} axisLine={{ stroke: colors.border }} tickLine={false} minTickGap={24} />
              <YAxis
                tick={{ fill: colors.textFaint, fontSize: 12 }} axisLine={false} tickLine={false} width={56}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v))}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(label: any) => formatDay(label)}
                formatter={(value: any) => [formatBRL(Number(value)), 'Receita'] as [string, string]}
                cursor={{ stroke: colors.border, strokeWidth: 1 }}
              />
              <Area
                type="monotone" dataKey="total" name="Receita"
                stroke={colors.primary} strokeWidth={2}
                fill={colors.primary} fillOpacity={0.1}
                dot={false} activeDot={{ r: 4, stroke: 'var(--color-surface)', strokeWidth: 2, fill: colors.primary }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
