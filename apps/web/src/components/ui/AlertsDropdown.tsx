import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { IconBell, IconBox, IconAlertTriangle, IconWallet, IconArrowDown, IconTrendUp } from './icons';
import { formatBRL } from '../../lib/format';

type Alerts = {
  criticalStock: number;
  lowStock: number;
  overduePayables: number;
  overdueAmount: number;
  openCashier: number;
  pendingPurchases: number;
  total: number;
};

const POLL_MS = 5 * 60 * 1000; // 5 min

export function AlertsDropdown() {
  const navigate  = useNavigate();
  const [alerts, setAlerts]   = useState<Alerts | null>(null);
  const [open, setOpen]       = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/dashboard/alerts');
      setAlerts(data);
    } catch { /* silently ignore — non-critical */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const badge = alerts?.total ?? 0;

  function go(path: string) { setOpen(false); navigate(path); }

  const items = alerts ? [
    alerts.criticalStock > 0 && {
      icon: <IconBox />, color: 'var(--color-error)', bg: 'var(--error-soft)',
      label: `${alerts.criticalStock} produto${alerts.criticalStock > 1 ? 's' : ''} sem estoque`,
      sub: 'Requer reposição imediata',
      path: '/estoque',
    },
    alerts.lowStock > 0 && {
      icon: <IconAlertTriangle />, color: 'var(--color-warning)', bg: 'var(--warning-soft)',
      label: `${alerts.lowStock} produto${alerts.lowStock > 1 ? 's' : ''} abaixo do mínimo`,
      sub: 'Estoque baixo — considere repor',
      path: '/estoque',
    },
    alerts.overduePayables > 0 && {
      icon: <IconTrendUp />, color: 'var(--color-error)', bg: 'var(--error-soft)',
      label: `${alerts.overduePayables} conta${alerts.overduePayables > 1 ? 's' : ''} a pagar vencida${alerts.overduePayables > 1 ? 's' : ''}`,
      sub: `Total: ${formatBRL(alerts.overdueAmount)}`,
      path: '/financeiro',
    },
    alerts.pendingPurchases > 0 && {
      icon: <IconArrowDown />, color: 'var(--color-text-mut)', bg: 'var(--color-surface-2)',
      label: `${alerts.pendingPurchases} pedido${alerts.pendingPurchases > 1 ? 's' : ''} de compra em aberto`,
      sub: 'Aguardando confirmação de recebimento',
      path: '/compras',
    },
    alerts.openCashier > 0 && {
      icon: <IconWallet />, color: 'var(--color-primary)', bg: 'var(--primary-soft)',
      label: 'Caixa aberto',
      sub: 'Sessão de caixa em andamento',
      path: '/caixa',
    },
  ].filter(Boolean) as Array<{ icon: any; color: string; bg: string; label: string; sub: string; path: string }> : [];

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`btn btn-sm btn-ghost alert-btn${open ? ' active' : ''}`}
        onClick={() => { setOpen((v) => !v); if (!open) load(); }}
        aria-label={`Alertas${badge > 0 ? ` (${badge})` : ''}`}
        title="Alertas operacionais"
      >
        <IconBell width={18} height={18} />
        {badge > 0 && (
          <span className="alert-badge">{badge > 99 ? '99+' : badge}</span>
        )}
      </button>

      {open && (
        <div className="alert-dropdown" role="menu">
          <div className="alert-dropdown-head">
            <strong>Alertas operacionais</strong>
            <button className="btn btn-xs btn-ghost" onClick={load} title="Atualizar" style={{ padding: 4, marginLeft: 'auto' }}>
              <span style={{ fontSize: 'var(--fs-xs)' }}>↻</span>
            </button>
          </div>

          {items.length === 0 ? (
            <div className="alert-empty">
              <span style={{ fontSize: 20 }}>✓</span>
              <span>Tudo em ordem!</span>
            </div>
          ) : (
            <div>
              {items.map((item, i) => (
                <button
                  key={i}
                  className="alert-item"
                  onClick={() => go(item.path)}
                  role="menuitem"
                >
                  <span className="alert-item-ico" style={{ background: item.bg, color: item.color }}>
                    {item.icon}
                  </span>
                  <span className="alert-item-text">
                    <span className="alert-item-label">{item.label}</span>
                    <span className="alert-item-sub">{item.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="alert-dropdown-foot">
            <button className="btn btn-xs btn-ghost" style={{ width: '100%' }} onClick={() => go('/estoque')}>
              Ver estoque completo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
