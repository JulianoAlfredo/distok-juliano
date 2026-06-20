import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../theme/ThemeProvider';

type NavItem = { to: string; label: string; roles: string[] };

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'operator'] },
  { to: '/produtos', label: 'Produtos', roles: ['admin', 'operator'] },
  { to: '/estoque', label: 'Estoque', roles: ['admin', 'operator'] },
  { to: '/funcionarios', label: 'Funcionários', roles: ['admin'] },
  { to: '/relatorios', label: 'Relatórios', roles: ['admin'] },
  { to: '/marca', label: 'Marca', roles: ['admin'] },
  { to: '/admin/tenants', label: 'Distribuidoras', roles: ['super_admin'] },
  { to: '/admin/planos', label: 'Planos', roles: ['super_admin'] },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { branding, t } = useTheme();
  const loc = useLocation();
  const role = user?.role ?? 'operator';
  const items = NAV.filter((n) => n.roles.includes(role)).map((n) => ({
    ...n,
    label:
      n.label === 'Produtos' ? `${t('product')}s` :
      n.label === 'Funcionários' ? `${t('employee')}s` :
      n.label,
  }));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'var(--sidebar-w, 240px) 1fr', minHeight: '100vh' }}>
      <aside style={{ background: 'var(--color-secondary)', color: '#fff', padding: 'var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-6)' }}>
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="logo" style={{ maxHeight: 32, maxWidth: 140 }} />
          ) : (
            <strong style={{ fontSize: 'var(--fs-lg)' }}>{branding.display_name || 'DISTOK'}</strong>
          )}
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
          {items.map((n) => {
            const active = loc.pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                style={{
                  color: '#fff',
                  textDecoration: 'none',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderRadius: 'var(--radius-sm)',
                  background: active ? 'rgba(255,255,255,.15)' : 'transparent',
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--sp-3) var(--sp-6)',
            background: 'var(--color-surface)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <span style={{ color: 'var(--color-text-mut)' }}>
            {user?.tenant?.name || branding.display_name || 'DISTOK'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <span style={{ fontSize: 'var(--fs-sm)' }}>{user?.name}</span>
            <button className="btn" style={{ border: '1px solid var(--color-border)' }} onClick={logout}>
              Sair
            </button>
          </div>
        </header>
        <main style={{ padding: 'var(--sp-6)', flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
