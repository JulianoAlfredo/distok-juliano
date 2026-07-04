import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  ReactNode, KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { api } from '../../api/client';
import {
  IconSearch, IconClose, IconDashboard, IconBox, IconPerson, IconTruck,
  IconArrowUp, IconArrowDown, IconLayers, IconWallet, IconTrendUp,
  IconTag, IconUsers, IconReport, IconHistory,
} from './icons';

// ─── Types ────────────────────────────────────────────────────────────────────

type CmdItem = {
  id: string;
  label: string;
  subtitle?: string;
  icon: ReactNode;
  shortcut?: string;
  action: () => void;
  section: string;
};

// ─── Context ──────────────────────────────────────────────────────────────────

type PaletteCtx = { open: () => void; close: () => void; toggle: () => void };
const Ctx = createContext<PaletteCtx | null>(null);

export function useCommandPalette(): PaletteCtx {
  return useContext(Ctx) ?? { open: () => {}, close: () => {}, toggle: () => {} };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);

  const open   = useCallback(() => setVisible(true),  []);
  const close  = useCallback(() => setVisible(false), []);
  const toggle = useCallback(() => setVisible((v) => !v), []);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle]);

  return (
    <Ctx.Provider value={{ open, close, toggle }}>
      {children}
      {visible && <PalettePortal onClose={close} />}
    </Ctx.Provider>
  );
}

// ─── Portal ───────────────────────────────────────────────────────────────────

const NAV_DEF = [
  { id: 'p-/', label: 'Dashboard', path: '/', icon: <IconDashboard />, roles: ['admin', 'operator'] },
  { id: 'p-/produtos', label: 'Produtos', path: '/produtos', icon: <IconBox />, roles: ['admin', 'operator'] },
  { id: 'p-/clientes', label: 'Clientes', path: '/clientes', icon: <IconPerson />, roles: ['admin', 'operator'] },
  { id: 'p-/fornecedores', label: 'Fornecedores', path: '/fornecedores', icon: <IconTruck />, roles: ['admin', 'operator'] },
  { id: 'p-/vendas', label: 'Vendas', path: '/vendas', icon: <IconArrowUp />, roles: ['admin', 'operator'] },
  { id: 'p-/compras', label: 'Compras', path: '/compras', icon: <IconArrowDown />, roles: ['admin', 'operator'] },
  { id: 'p-/estoque', label: 'Estoque', path: '/estoque', icon: <IconLayers />, roles: ['admin', 'operator'] },
  { id: 'p-/caixa', label: 'Caixa', path: '/caixa', icon: <IconWallet />, roles: ['admin', 'operator'] },
  { id: 'p-/financeiro', label: 'Financeiro', path: '/financeiro', icon: <IconTrendUp />, roles: ['admin'] },
  { id: 'p-/cadastros', label: 'Cadastros Auxiliares', path: '/cadastros', icon: <IconTag />, roles: ['admin'] },
  { id: 'p-/funcionarios', label: 'Funcionários', path: '/funcionarios', icon: <IconUsers />, roles: ['admin'] },
  { id: 'p-/relatorios', label: 'Relatórios', path: '/relatorios', icon: <IconReport />, roles: ['admin'] },
];

const QUICK_DEF = [
  { id: 'qa-venda', label: 'Nova venda', subtitle: 'Registrar venda e baixar estoque', path: '/vendas', autoOpen: 'new', icon: <IconArrowUp />, roles: ['admin', 'operator'] },
  { id: 'qa-compra', label: 'Novo pedido de compra', subtitle: 'Registrar entrada de mercadoria', path: '/compras', autoOpen: 'new', icon: <IconArrowDown />, roles: ['admin', 'operator'] },
  { id: 'qa-estoque', label: 'Lançar movimentação', subtitle: 'Entrada ou saída de estoque', path: '/estoque', autoOpen: 'new', icon: <IconLayers />, roles: ['admin', 'operator'] },
  { id: 'qa-produto', label: 'Novo produto', subtitle: 'Cadastrar produto ou serviço', path: '/produtos', autoOpen: 'new', icon: <IconBox />, roles: ['admin'] },
  { id: 'qa-cliente', label: 'Novo cliente', subtitle: 'Cadastrar cliente', path: '/clientes', autoOpen: 'new', icon: <IconPerson />, roles: ['admin', 'operator'] },
  { id: 'qa-financeiro', label: 'Novo lançamento financeiro', subtitle: 'A pagar ou a receber', path: '/financeiro', autoOpen: 'new', icon: <IconTrendUp />, roles: ['admin'] },
];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function PalettePortal({ onClose }: { onClose: () => void }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const role = user?.role ?? 'operator';

  const [query, setQuery]     = useState('');
  const [active, setActive]   = useState(0);
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // API search on query
  useEffect(() => {
    if (!query.trim()) { setProducts([]); setCustomers([]); return; }
    setSearching(true);
    const controller = new AbortController();
    const h = setTimeout(async () => {
      try {
        const [p, c] = await Promise.all([
          api.get('/products', { params: { search: query, status: 'active' }, signal: controller.signal }).then((r) => r.data).catch(() => []),
          api.get('/customers', { params: { search: query, status: 'active' }, signal: controller.signal }).then((r) => r.data?.items ?? r.data ?? []).catch(() => []),
        ]);
        setProducts(p.slice(0, 5));
        setCustomers(c.slice(0, 5));
      } finally { setSearching(false); }
    }, 220);
    return () => { clearTimeout(h); controller.abort(); };
  }, [query]);

  function go(path: string, autoOpen?: string) {
    onClose();
    if (autoOpen) {
      navigate(path, { state: { autoOpen } });
    } else if (location.pathname !== path) {
      navigate(path);
    }
  }

  // Build item list
  const q = normalize(query);

  const navItems: CmdItem[] = NAV_DEF
    .filter((n) => n.roles.includes(role))
    .filter((n) => !q || normalize(n.label).includes(q))
    .map((n) => ({ id: n.id, label: n.label, icon: n.icon, section: 'Navegar para', action: () => go(n.path) }));

  const quickItems: CmdItem[] = QUICK_DEF
    .filter((n) => n.roles.includes(role))
    .filter((n) => !q || normalize(n.label).includes(q) || normalize(n.subtitle ?? '').includes(q))
    .map((n) => ({ id: n.id, label: n.label, subtitle: n.subtitle, icon: n.icon, section: 'Ações rápidas', action: () => go(n.path, n.autoOpen) }));

  const productItems: CmdItem[] = products.map((p: any) => ({
    id: `prod-${p.id}`, label: p.name, subtitle: `${p.sku || '—'} · Estoque: consulte a página`,
    icon: <IconBox />, section: 'Produtos', action: () => go('/produtos'),
  }));

  const customerItems: CmdItem[] = customers.map((c: any) => ({
    id: `cust-${c.id}`, label: c.name, subtitle: c.phone || c.email || undefined,
    icon: <IconPerson />, section: 'Clientes', action: () => go('/clientes'),
  }));

  const historyItems: CmdItem[] = !q ? [
    { id: 'hist-vendas', label: 'Últimas vendas', icon: <IconHistory />, section: 'Atalhos', action: () => go('/vendas') },
    { id: 'hist-compras', label: 'Últimas compras', icon: <IconHistory />, section: 'Atalhos', action: () => go('/compras') },
  ] : [];

  // Compose final list (show empty state if no results when searching)
  const allItems: CmdItem[] = q
    ? [...navItems, ...quickItems, ...productItems, ...customerItems]
    : [...quickItems, ...navItems, ...historyItems];

  const total = allItems.length;

  // Keyboard navigation
  useEffect(() => { setActive(0); }, [query]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % Math.max(total, 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => (a - 1 + Math.max(total, 1)) % Math.max(total, 1)); }
    if (e.key === 'Enter' && total > 0) { e.preventDefault(); allItems[active]?.action(); }
  }

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  // Group items by section for rendering
  const sections: Array<{ label: string; items: CmdItem[] }> = [];
  for (const item of allItems) {
    const sec = sections.find((s) => s.label === item.section);
    if (sec) sec.items.push(item);
    else sections.push({ label: item.section, items: [item] });
  }

  let globalIdx = 0;

  return createPortal(
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        {/* Search input */}
        <div className="cmd-search-row">
          <IconSearch width={18} height={18} style={{ color: 'var(--color-text-faint)', flex: 'none' }} />
          <input
            ref={inputRef}
            className="cmd-input"
            placeholder="Buscar páginas, ações, produtos, clientes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKey}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
          />
          {searching && <span className="spin" style={{ flex: 'none' }} />}
          {query && !searching && (
            <button className="btn btn-sm btn-ghost" style={{ padding: 4, flex: 'none' }} onClick={() => setQuery('')} aria-label="Limpar busca">
              <IconClose width={15} height={15} />
            </button>
          )}
          <kbd className="cmd-kbd">Esc</kbd>
        </div>

        {/* Results */}
        <div className="cmd-results" ref={listRef} role="listbox">
          {sections.length === 0 ? (
            <div className="cmd-empty">{q ? `Nenhum resultado para "${query}"` : 'Nenhuma ação disponível'}</div>
          ) : (
            sections.map((sec) => (
              <div key={sec.label}>
                <div className="cmd-section">{sec.label}</div>
                {sec.items.map((item) => {
                  const idx = globalIdx++;
                  const isActive = idx === active;
                  return (
                    <div
                      key={item.id}
                      className={`cmd-item${isActive ? ' active' : ''}`}
                      data-active={isActive}
                      onClick={item.action}
                      onMouseEnter={() => setActive(idx)}
                      role="option"
                      aria-selected={isActive}
                    >
                      <span className="cmd-item-ico">{item.icon}</span>
                      <span className="cmd-item-text">
                        <span className="cmd-item-label">{item.label}</span>
                        {item.subtitle && <span className="cmd-item-sub">{item.subtitle}</span>}
                      </span>
                      {item.shortcut && <kbd className="cmd-kbd">{item.shortcut}</kbd>}
                      {isActive && <span className="cmd-kbd-enter">↵</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="cmd-footer">
          <span><kbd className="cmd-kbd-inline">↑↓</kbd> navegar</span>
          <span><kbd className="cmd-kbd-inline">↵</kbd> abrir</span>
          <span><kbd className="cmd-kbd-inline">Esc</kbd> fechar</span>
          <span style={{ marginLeft: 'auto', color: 'var(--color-text-faint)', fontSize: 'var(--fs-xs)' }}>
            {total} resultado{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
