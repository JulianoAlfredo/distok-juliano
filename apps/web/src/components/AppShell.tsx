import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../theme/ThemeProvider';
import { useCommandPalette } from './ui/CommandPalette';
import { AlertsDropdown } from './ui/AlertsDropdown';
import { usePreferences } from '../hooks/usePreferences';
import { BottomNav, BottomNavItem } from './BottomNav';
import {
  IconDashboard, IconBox, IconLayers, IconUsers, IconReport, IconBrand,
  IconBuilding, IconTag, IconLogout, IconMenu, IconSearch, IconPerson, IconTruck,
  IconArrowDown, IconArrowUp, IconWallet, IconTrendUp, IconChevronDown,
} from './ui/icons';

type NavItem = { to: string; label: string; roles: string[]; icon: ReactNode };
type NavSection = { label: string; items: NavItem[] };

/** Navegação agrupada por seção — antes era uma lista única de 17 itens sem organização. */
const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Principal',
    items: [
      { to: '/', label: 'Dashboard', roles: ['admin', 'operator'], icon: <IconDashboard /> },
    ],
  },
  {
    label: 'Operação',
    items: [
      { to: '/produtos', label: 'Produtos', roles: ['admin', 'operator'], icon: <IconBox /> },
      { to: '/estoque', label: 'Estoque', roles: ['admin', 'operator'], icon: <IconLayers /> },
      { to: '/vendas', label: 'Vendas', roles: ['admin', 'operator'], icon: <IconArrowUp /> },
      { to: '/compras', label: 'Compras', roles: ['admin', 'operator'], icon: <IconArrowDown /> },
      { to: '/clientes', label: 'Clientes', roles: ['admin', 'operator'], icon: <IconPerson /> },
      { to: '/fornecedores', label: 'Fornecedores', roles: ['admin', 'operator'], icon: <IconTruck /> },
      { to: '/caixa', label: 'Caixa', roles: ['admin', 'operator'], icon: <IconWallet /> },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { to: '/financeiro', label: 'Financeiro', roles: ['admin'], icon: <IconTrendUp /> },
      { to: '/funcionarios', label: 'Funcionários', roles: ['admin'], icon: <IconUsers /> },
      { to: '/relatorios', label: 'Relatórios', roles: ['admin'], icon: <IconReport /> },
      { to: '/cadastros', label: 'Cadastros', roles: ['admin'], icon: <IconTag /> },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { to: '/marca', label: 'Marca', roles: ['admin'], icon: <IconBrand /> },
      { to: '/integracoes/ze-delivery', label: 'Zé Delivery', roles: ['admin'], icon: <IconTruck /> },
      { to: '/minha-conta', label: 'Minha Conta', roles: ['admin', 'operator'], icon: <IconPerson /> },
    ],
  },
  {
    label: 'Administração',
    items: [
      { to: '/admin/tenants', label: 'Distribuidoras', roles: ['super_admin'], icon: <IconBuilding /> },
      { to: '/admin/planos', label: 'Planos', roles: ['super_admin'], icon: <IconTag /> },
    ],
  },
];

/** Atalhos da barra inferior (mobile, <640px) — os itens do dia a dia, por role. O resto fica na gaveta ("Mais"). */
const BOTTOM_NAV_BY_ROLE: Record<string, { to: string; label: string; icon: ReactNode }[]> = {
  operator: [
    { to: '/', label: 'Início', icon: <IconDashboard /> },
    { to: '/estoque', label: 'Estoque', icon: <IconLayers /> },
    { to: '/vendas', label: 'Vendas', icon: <IconArrowUp /> },
    { to: '/caixa', label: 'Caixa', icon: <IconWallet /> },
  ],
  admin: [
    { to: '/', label: 'Início', icon: <IconDashboard /> },
    { to: '/produtos', label: 'Produtos', icon: <IconBox /> },
    { to: '/estoque', label: 'Estoque', icon: <IconLayers /> },
    { to: '/financeiro', label: 'Financeiro', icon: <IconTrendUp /> },
  ],
  super_admin: [
    { to: '/admin/tenants', label: 'Distrib.', icon: <IconBuilding /> },
    { to: '/admin/planos', label: 'Planos', icon: <IconTag /> },
  ],
};

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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const role = user?.role ?? 'operator';
  const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

  useEffect(() => {
    if (!userMenuOpen) return;
    function onClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  function mapLabel(label: string) {
    if (label === 'Produtos') return `${t('product')}s`;
    if (label === 'Funcionários') return `${t('employee')}s`;
    return label;
  }

  const sections = NAV_SECTIONS
    .map((s) => ({
      label: s.label,
      items: s.items.filter((n) => n.roles.includes(role)).map((n) => ({ ...n, label: mapLabel(n.label) })),
    }))
    .filter((s) => s.items.length > 0);

  const bottomItems: BottomNavItem[] = (BOTTOM_NAV_BY_ROLE[role] || []).map((n) => ({ ...n, label: mapLabel(n.label) }));

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
        {sections.map((s) => (
          <div className="shell-nav-section" key={s.label}>
            <div className="shell-nav-label">{s.label}</div>
            {s.items.map((n) => {
              const active = loc.pathname === n.to;
              return (
                <Link key={n.to} to={n.to} className={`shell-link${active ? ' active' : ''}`} onClick={() => setOpen(false)}>
                  <span className="shell-link-ico">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        ))}
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
          <div className="shell-header-leading">
            <button className="btn btn-ghost btn-sm shell-burger" onClick={() => setOpen(true)} aria-label="Menu">
              <IconMenu />
            </button>
            <button className="cmd-trigger" onClick={openPalette} title="Abrir paleta de comandos">
              <IconSearch width={15} height={15} />
              <span className="cmd-trigger-label">Buscar ou ir para…</span>
              <kbd className="cmd-kbd">{isMac ? '⌘' : 'Ctrl'}K</kbd>
            </button>
          </div>
          <div className="shell-header-trailing">
            <AlertsDropdown />
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                className={`user-menu-trigger${userMenuOpen ? ' active' : ''}`}
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-label="Menu do usuário"
              >
                <span className="shell-avatar shell-avatar-sm">{initials}</span>
                <span className="user-menu-name">{user?.name?.split(' ')[0]}</span>
                <IconChevronDown width={15} height={15} />
              </button>
              {userMenuOpen && (
                <div className="user-menu-dropdown" role="menu">
                  <div className="user-menu-head">
                    <div className="shell-user-name">{user?.name}</div>
                    <div className="shell-user-role" style={{ color: 'var(--color-text-mut)' }}>{roleLabel[role]}</div>
                  </div>
                  <Link to="/minha-conta" className="user-menu-item" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                    <IconPerson width={16} height={16} /> Minha Conta
                  </Link>
                  <button
                    className="user-menu-item"
                    role="menuitem"
                    onClick={() => { updatePrefs({ density: prefs.density === 'comfortable' ? 'compact' : 'comfortable' }); setUserMenuOpen(false); }}
                  >
                    <span style={{ fontWeight: 700, width: 16, textAlign: 'center' }}>{prefs.density === 'comfortable' ? '≡' : '☰'}</span>
                    Modo {prefs.density === 'comfortable' ? 'compacto' : 'confortável'}
                  </button>
                  <button className="user-menu-item user-menu-danger" role="menuitem" onClick={logout}>
                    <IconLogout width={16} height={16} /> Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="shell-main">{children}</main>
        <BottomNav items={bottomItems} onMore={() => setOpen(true)} />
      </div>
    </div>
  );
}

const shellCss = `
.shell { display: grid; grid-template-columns: var(--sidebar-w) 1fr; min-height: 100vh; }
.shell-aside { background: var(--color-secondary); color: #fff; padding: var(--sp-4) var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); position: sticky; top: 0; height: 100vh; overflow-y: auto; }
.shell-aside-mobile { display: none; }
.shell-brand { padding: var(--sp-3) var(--sp-3) var(--sp-5); }
.shell-nav { display: flex; flex-direction: column; gap: var(--sp-4); flex: 1; }
.shell-nav-section { display: flex; flex-direction: column; gap: 2px; }
.shell-nav-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: rgba(255,255,255,0.4); padding: 0 var(--sp-3); margin-bottom: 4px; }
.shell-link { display: flex; align-items: center; gap: var(--sp-3); color: rgba(255,255,255,0.72); text-decoration: none; padding: 10px var(--sp-3); border-radius: var(--radius-md); font-size: var(--fs-sm); font-weight: 500; transition: background var(--t-fast), color var(--t-fast); }
.shell-link:hover { background: rgba(255,255,255,0.08); color: #fff; }
.shell-link.active { background: var(--color-primary); color: var(--on-primary); font-weight: 600; box-shadow: var(--shadow-sm); }
.shell-link-ico { display: inline-flex; }
.shell-link-ico svg { width: 19px; height: 19px; }
.shell-user { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-top: 1px solid rgba(255,255,255,0.1); margin-top: var(--sp-2); }
.shell-avatar { width: 38px; height: 38px; border-radius: 50%; background: var(--color-primary); color: var(--on-primary); display: grid; place-items: center; font-weight: 700; font-size: var(--fs-sm); flex: none; }
.shell-avatar-sm { width: 28px; height: 28px; font-size: 12px; }
.shell-user-name { font-size: var(--fs-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.shell-user-role { font-size: var(--fs-xs); color: rgba(255,255,255,0.55); }
.shell-body { display: flex; flex-direction: column; min-width: 0; }
.shell-header { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) var(--sp-6); background: var(--color-surface); border-bottom: 1px solid var(--color-border); position: sticky; top: 0; z-index: 20; }
.shell-header-leading { display: flex; align-items: center; gap: var(--sp-3); flex: 1; min-width: 0; }
.shell-header-trailing { display: flex; align-items: center; gap: var(--sp-2); flex: none; }
.shell-main { padding: var(--sp-8) var(--sp-6); flex: 1; max-width: 1280px; width: 100%; }
.shell-burger { display: none; flex: none; }
.shell-backdrop { display: none; }

.user-menu-trigger { display: flex; align-items: center; gap: 6px; padding: 4px 10px 4px 4px; min-height: 40px; border: 1px solid transparent; border-radius: var(--radius-md); background: transparent; cursor: pointer; color: var(--color-text); transition: background var(--t-fast); }
.user-menu-trigger:hover, .user-menu-trigger.active { background: var(--color-surface-2); }
.user-menu-name { font-size: var(--fs-sm); font-weight: 600; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.user-menu-dropdown { position: absolute; top: calc(100% + 8px); right: 0; width: 220px; background: var(--color-surface); border: 1px solid var(--color-border-strong); border-radius: var(--radius-lg); box-shadow: var(--shadow-lg); z-index: 200; overflow: hidden; }
.user-menu-head { padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--color-border); }

/* Tablet: sidebar fixa vira gaveta, hambúrguer aparece */
@media (max-width: 1024px) {
  .shell { grid-template-columns: 1fr; }
  .shell > .shell-aside { display: none; }
  .shell-burger { display: inline-flex; }
  .shell-backdrop { display: block; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 40; }
  .shell-aside-mobile { display: block; position: fixed; left: 0; top: 0; bottom: 0; width: var(--sidebar-w); z-index: 50; transform: translateX(-100%); transition: transform var(--t); }
  .shell-aside-mobile.open { transform: none; }
  .shell-aside-mobile .shell-aside { height: 100%; }
}

/* Mobile: barra inferior substitui o hambúrguer do header; header/conteúdo ganham respiro pro polegar */
@media (max-width: 640px) {
  .shell-burger { display: none; }
  .shell-header { padding: var(--sp-2) var(--sp-4); }
  .shell-main { padding: var(--sp-4); padding-bottom: calc(var(--sp-8) + 64px); }
  .user-menu-name { display: none; }
  .cmd-trigger-label, .cmd-kbd { display: none; }
  .cmd-trigger { min-width: 0; padding: 8px; }
}
`;
