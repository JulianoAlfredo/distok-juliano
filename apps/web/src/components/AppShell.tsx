import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../theme/ThemeProvider';
import { useCommandPalette } from './ui/CommandPalette';
import { AlertsDropdown } from './ui/AlertsDropdown';
import { usePreferences } from '../hooks/usePreferences';
import {
  IconDashboard, IconBox, IconLayers, IconUsers, IconReport, IconBrand,
  IconBuilding, IconTag, IconLogout, IconMenu, IconSearch, IconPerson, IconTruck, IconArrowDown, IconArrowUp, IconWallet, IconTrendUp,
} from './ui/icons';

type NavItem = { to: string; label: string; roles: string[]; icon: ReactNode };

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', roles: ['admin', 'operator'], icon: <IconDashboard /> },
  { to: '/produtos', label: 'Produtos', roles: ['admin', 'operator'], icon: <IconBox /> },
  { to: '/clientes',     label: 'Clientes',     roles: ['admin', 'operator'], icon: <IconPerson /> },
  { to: '/fornecedores', label: 'Fornecedores', roles: ['admin', 'operator'], icon: <IconTruck /> },
  { to: '/vendas',       label: 'Vendas',       roles: ['admin', 'operator'], icon: <IconArrowUp /> },
  { to: '/compras',      label: 'Compras',      roles: ['admin', 'operator'], icon: <IconArrowDown /> },
  { to: '/cadastros',    label: 'Cadastros',    roles: ['admin'],             icon: <IconTag /> },
  { to: '/caixa',      label: 'Caixa',      roles: ['admin', 'operator'], icon: <IconWallet /> },
  { to: '/financeiro', label: 'Financeiro', roles: ['admin'],             icon: <IconTrendUp /> },
  { to: '/estoque', label: 'Estoque', roles: ['admin', 'operator'], icon: <IconLayers /> },
  { to: '/funcionarios', label: 'Funcionários', roles: ['admin'], icon: <IconUsers /> },
  { to: '/relatorios', label: 'Relatórios', roles: ['admin'], icon: <IconReport /> },
  { to: '/marca', label: 'Marca', roles: ['admin'], icon: <IconBrand /> },
  { to: '/integracoes/ze-delivery', label: 'Zé Delivery', roles: ['admin'], icon: <IconTruck /> },
  { to: '/minha-conta', label: 'Minha Conta', roles: ['admin', 'operator'], icon: <IconPerson /> },
  { to: '/admin/tenants', label: 'Distribuidoras', roles: ['super_admin'], icon: <IconBuilding /> },
  { to: '/admin/planos', label: 'Planos', roles: ['super_admin'], icon: <IconTag /> },
];

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  operator: 'Operador',
};

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { branding, t } = useTheme();
  const { open: openPalette } = useCommandPalette();
  const { prefs, update: updatePrefs } = usePreferences();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const role = user?.role ?? 'operator';
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  const items = NAV.filter((n) => n.roles.includes(role)).map((n) => ({
    ...n,
    label:
      n.label === 'Produtos' ? `${t('product')}s` :
      n.label === 'Funcionários' ? `${t('employee')}s` :
      n.label,
  }));

  const initials = (user?.name || 'U').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

  const sidebar = (
    <aside className="shell-aside">
      <div className="shell-brand">
        {branding.logo_url ? (
          <img src={branding.logo_url} alt="logo" style={{ maxHeight: 34, maxWidth: 150 }} />
        ) : (
          <strong style={{ fontSize: 'var(--fs-lg)', letterSpacing: '-0.02em' }}>
            {branding.display_name || 'DISTOK'}
          </strong>
        )}
      </div>
      <nav className="shell-nav">
        {items.map((n) => {
          const active = loc.pathname === n.to;
          return (
            <Link key={n.to} to={n.to} className={`shell-link${active ? ' active' : ''}`} onClick={() => setOpen(false)}>
              <span className="shell-link-ico">{n.icon}</span>
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="shell-user">
        <div className="shell-avatar">{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="shell-user-name">{user?.name}</div>
          <div className="shell-user-role">{roleLabel[role]}</div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="shell">
      <a href="#main-content" className="skip-nav">Pular para o conteúdo</a>
      <style>{shellCss}</style>
      {sidebar}
      {open && <div className="shell-backdrop" onClick={() => setOpen(false)} />}
      <div className={`shell-aside-mobile${open ? ' open' : ''}`}>{sidebar}</div>

      <div className="shell-body">
        <header className="shell-header">
          <button className="btn btn-ghost btn-sm shell-burger" onClick={() => setOpen(true)} aria-label="Menu">
            <IconMenu />
          </button>
          <button className="cmd-trigger" onClick={openPalette} title="Abrir paleta de comandos">
            <IconSearch width={15} height={15} />
            <span style={{ flex: 1 }}>Buscar ou ir para…</span>
            <kbd className="cmd-kbd">{isMac ? '⌘' : 'Ctrl'}K</kbd>
          </button>
          <AlertsDropdown />
          <button
            className="btn btn-sm btn-ghost"
            title={prefs.density === 'comfortable' ? 'Modo compacto' : 'Modo confortável'}
            onClick={() => updatePrefs({ density: prefs.density === 'comfortable' ? 'compact' : 'comfortable' })}
            aria-label="Alternar densidade da tabela"
            style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, letterSpacing: '.02em' }}
          >
            {prefs.density === 'comfortable' ? '≡' : '☰'}
          </button>
          <button className="btn btn-sm" onClick={logout}>
            <IconLogout width={16} height={16} /> Sair
          </button>
        </header>
        <main id="main-content" className="shell-main">{children}</main>
      </div>
    </div>
  );
}

const shellCss = `
.shell { display: grid; grid-template-columns: var(--sidebar-w) 1fr; min-height: 100vh; }
.shell-aside { background: var(--color-secondary); color: #fff; padding: var(--sp-4) var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); position: sticky; top: 0; height: 100vh; }
.shell-aside-mobile { display: none; }
.shell-brand { padding: var(--sp-3) var(--sp-3) var(--sp-5); }
.shell-nav { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.shell-link { display: flex; align-items: center; gap: var(--sp-3); color: rgba(255,255,255,0.72); text-decoration: none; padding: 10px var(--sp-3); border-radius: var(--radius-md); font-size: var(--fs-sm); font-weight: 500; transition: background var(--t-fast), color var(--t-fast); }
.shell-link:hover { background: rgba(255,255,255,0.08); color: #fff; }
.shell-link.active { background: var(--color-primary); color: var(--on-primary); font-weight: 600; box-shadow: var(--shadow-sm); }
.shell-link-ico { display: inline-flex; }
.shell-link-ico svg { width: 19px; height: 19px; }
.shell-user { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-top: 1px solid rgba(255,255,255,0.1); margin-top: var(--sp-2); }
.shell-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--color-primary); color: var(--on-primary); display: grid; place-items: center; font-weight: 700; font-size: var(--fs-sm); flex: none; }
.shell-user-name { font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shell-user-role { font-size: var(--fs-xs); color: rgba(255,255,255,0.55); }
.shell-body { display: flex; flex-direction: column; min-width: 0; }
.shell-header { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) var(--sp-6); background: var(--color-surface); border-bottom: 1px solid var(--color-border); position: sticky; top: 0; z-index: 20; }
.shell-main { padding: var(--sp-8) var(--sp-6); flex: 1; max-width: 1280px; width: 100%; }
.shell-burger { display: none; }
.shell-backdrop { display: none; }
@media (max-width: 900px) {
  .shell { grid-template-columns: 1fr; }
  .shell > .shell-aside { display: none; }
  .shell-burger { display: inline-flex; }
  .shell-backdrop { display: block; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 40; }
  .shell-aside-mobile { display: block; position: fixed; left: 0; top: 0; bottom: 0; width: var(--sidebar-w); z-index: 50; transform: translateX(-100%); transition: transform var(--t); }
  .shell-aside-mobile.open { transform: none; }
  .shell-aside-mobile .shell-aside { height: 100%; }
}
`;
