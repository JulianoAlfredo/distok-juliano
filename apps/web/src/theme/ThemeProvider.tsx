import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';

type Branding = {
  display_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  color_accent: string | null;
};

type Terminology = Record<string, string>;

type ThemeState = {
  loading: boolean;
  tenant: { id: string; name: string; slug: string; status: string } | null;
  branding: Branding;
  terminology: Terminology;
  t: (key: string) => string;
};

const ThemeContext = createContext<ThemeState | null>(null);

/** Calcula cor de texto legível sobre uma cor de fundo (contraste — design §3.3). */
function readableOn(hex: string | null): string {
  if (!hex) return '#ffffff';
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
}

function applyBranding(branding: Branding) {
  const root = document.documentElement;
  if (branding.color_primary) {
    root.style.setProperty('--color-primary', branding.color_primary);
    root.style.setProperty('--on-primary', readableOn(branding.color_primary));
  }
  if (branding.color_secondary) root.style.setProperty('--color-secondary', branding.color_secondary);
  if (branding.color_accent) root.style.setProperty('--color-accent', branding.color_accent);
  if (branding.favicon_url) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = branding.favicon_url;
  }
  if (branding.display_name) document.title = branding.display_name;
}

/** Deriva o slug do tenant: subdomínio ou ?slug= (dev). */
function detectSlug(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('slug') || params.get('tenant');
  if (fromQuery) return fromQuery;
  const host = window.location.hostname;
  const parts = host.split('.');
  if (parts.length > 2 && !['www', 'app', 'api'].includes(parts[0])) return parts[0];
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>({
    loading: true,
    tenant: null,
    branding: {
      display_name: 'DISTOK',
      logo_url: null,
      favicon_url: null,
      color_primary: '#2563EB',
      color_secondary: '#1E293B',
      color_accent: '#F59E0B',
    },
    terminology: {},
    t: (k) => k,
  });

  useEffect(() => {
    const slug = detectSlug();
    api
      .get('/public/tenant-theme', { params: slug ? { slug } : {} })
      .then((res) => {
        const { tenant, branding, terminology } = res.data;
        applyBranding(branding);
        setState({
          loading: false,
          tenant,
          branding,
          terminology,
          t: (key: string) => terminology[key] || key,
        });
      })
      .catch(() => setState((s) => ({ ...s, loading: false })));
  }, []);

  return <ThemeContext.Provider value={state}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}
