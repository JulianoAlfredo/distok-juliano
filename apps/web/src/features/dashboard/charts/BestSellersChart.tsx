import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../../../components/ui';
import { IconBox } from '../../../components/ui/icons';
import { formatBRL } from '../../../lib/format';
import { useChartColors } from './chartTheme';
import { BestSeller } from '../types';

const tooltipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 13,
  boxShadow: 'var(--shadow-sm)',
};

function truncate(name: string, max = 18) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/** Barras horizontais dos 5 produtos mais vendidos — dado já vem em
 *  summary.bestSellers do GET /dashboard/summary existente, sem fetch novo.
 *  Uma única grandeza plotada (qtd. vendida); a receita fica no tooltip —
 *  evita encoding de duas medidas de escalas diferentes na mesma barra. */
export function BestSellersChart({ bestSellers }: { bestSellers: BestSeller[] }) {
  const colors = useChartColors();

  if (!bestSellers || bestSellers.length === 0) {
    return <EmptyState icon={<IconBox />} title="Sem dados" hint="Produtos mais vendidos aparecerão aqui." />;
  }

  const data = [...bestSellers].sort((a, b) => b.qty_sold - a.qty_sold);
  const height = Math.max(180, data.length * 44);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 28, bottom: 4, left: 4 }}>
        <CartesianGrid horizontal={false} stroke={colors.border} strokeWidth={1} />
        <XAxis type="number" allowDecimals={false} tick={{ fill: colors.textFaint, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category" dataKey="name" width={120}
          tick={{ fill: colors.textFaint, fontSize: 12 }} axisLine={false} tickLine={false}
          tickFormatter={truncate}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: any, _name: any, item: any) =>
            [`${value} un. · ${formatBRL(item?.payload?.revenue ?? 0)}`, 'Vendidos'] as [string, string]}
          labelFormatter={(label: any) => label}
          cursor={{ fill: colors.border, opacity: 0.3 }}
        />
        <Bar dataKey="qty_sold" name="Vendidos" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((d) => <Cell key={d.id} fill={colors.primary} />)}
          <LabelList dataKey="qty_sold" position="right" style={{ fill: 'var(--color-text)', fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
