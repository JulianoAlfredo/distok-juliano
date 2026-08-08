import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconMenu } from './ui/icons';

export type BottomNavItem = { to: string; label: string; icon: ReactNode };

/**
 * Barra fixa no rodapé, só visível abaixo de 640px (ver tokens.css). Os itens são os
 * atalhos mais usados por role — o resto continua acessível pela gaveta (botão "Mais").
 */
export function BottomNav({ items, onMore }: { items: BottomNavItem[]; onMore: () => void }) {
  const loc = useLocation();
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map((n) => {
        const active = loc.pathname === n.to;
        return (
          <Link key={n.to} to={n.to} className={`bottom-nav-item${active ? ' active' : ''}`}>
            <span className="bottom-nav-ico">{n.icon}</span>
            <span className="bottom-nav-label">{n.label}</span>
          </Link>
        );
      })}
      <button type="button" className="bottom-nav-item" onClick={onMore}>
        <span className="bottom-nav-ico"><IconMenu /></span>
        <span className="bottom-nav-label">Mais</span>
      </button>
    </nav>
  );
}
