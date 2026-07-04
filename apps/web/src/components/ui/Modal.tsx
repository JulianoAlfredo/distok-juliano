import { useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './icons';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const widths: Record<Size, number> = { sm: 440, md: 560, lg: 720, xl: 920 };

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: Size;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    // Foca o diálogo ao abrir para leitores de tela
    const id = setTimeout(() => dialogRef.current?.focus(), 50);
    return () => { document.removeEventListener('keydown', h); clearTimeout(id); };
  }, [open, onClose]);

  if (!open) return null;

  const labelId = `modal-title-${title.replace(/\s+/g, '-').toLowerCase()}`;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        className="modal"
        style={{ maxWidth: widths[size] }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        tabIndex={-1}
      >
        <div className="modal-head">
          <div>
            <h3 id={labelId} style={{ margin: 0 }}>{title}</h3>
            {subtitle && <div className="muted" style={{ fontSize: 'var(--fs-xs)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Fechar">
            <IconClose width={18} height={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
