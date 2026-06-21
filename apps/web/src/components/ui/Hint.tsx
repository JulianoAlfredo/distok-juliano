import { ReactNode } from 'react';

/** Ajuda contextual: um "?" discreto que mostra uma explicação simples ao passar o mouse
 *  ou focar (acessível por teclado). Pensado para quem não conhece termos técnicos. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <span className="hint" tabIndex={0} role="note" aria-label={typeof children === 'string' ? children : 'ajuda'}>
      ?
      <span className="hint-pop">{children}</span>
    </span>
  );
}

/** Rótulo de campo com (opcional) marcador de obrigatório e ajuda. */
export function FieldLabel({ children, required, hint }: { children: ReactNode; required?: boolean; hint?: ReactNode }) {
  return (
    <label className="row" style={{ gap: 6, marginBottom: 6 }}>
      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--color-text-mut)' }}>
        {children}{required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </span>
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}
