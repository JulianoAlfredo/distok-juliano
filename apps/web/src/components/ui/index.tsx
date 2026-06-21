import { ReactNode } from 'react';

/** Cabeçalho de página padrão. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  );
}

/** Badge de status semântico. */
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active: { cls: 'badge-success', label: 'Ativo' },
    inactive: { cls: 'badge-neutral', label: 'Inativo' },
    suspended: { cls: 'badge-warning', label: 'Suspenso' },
    ok: { cls: 'badge-success', label: 'OK' },
    low: { cls: 'badge-warning', label: 'Baixo' },
    zero: { cls: 'badge-danger', label: 'Zerado' },
  };
  const it = map[status] ?? { cls: 'badge-neutral', label: status };
  return <span className={`badge ${it.cls}`}>{it.label}</span>;
}

/** Estado vazio com ícone e mensagem. */
export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-ico">{icon}</div>}
      <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{title}</div>
      {hint && <div className="mt-2" style={{ fontSize: 'var(--fs-sm)' }}>{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Spinner centralizado para carregamento de página. */
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="empty" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)' }}>
      <span className="spin" />
      <span style={{ fontSize: 'var(--fs-sm)' }}>{label}</span>
    </div>
  );
}
