import { useMemo } from 'react';
import { useTheme } from '../../../theme/ThemeProvider';

/** Cores que os gráficos do dashboard usam, sempre lidas em runtime das CSS
 *  custom properties injetadas pelo ThemeProvider — o app é white-label, então
 *  NUNCA hardcode hex aqui. Memoizado e recalculado quando o branding do
 *  tenant termina de carregar (as custom properties só são setadas depois
 *  que /public/tenant-theme responde). */
export interface ChartColors {
  primary: string;
  danger: string;
  success: string;
  warning: string;
  border: string;
  textFaint: string;
}

const FALLBACK: ChartColors = {
  primary: '#2563eb',
  danger: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  border: '#e6eaf0',
  textFaint: '#94a3b8',
};

function readVar(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function useChartColors(): ChartColors {
  const { loading, branding } = useTheme();
  return useMemo(
    () => ({
      primary: readVar('--color-primary', FALLBACK.primary),
      danger: readVar('--color-danger', FALLBACK.danger),
      success: readVar('--color-success', FALLBACK.success),
      warning: readVar('--color-warning', FALLBACK.warning),
      border: readVar('--color-border', FALLBACK.border),
      textFaint: readVar('--color-text-faint', FALLBACK.textFaint),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, branding.color_primary, branding.color_secondary, branding.color_accent],
  );
}
