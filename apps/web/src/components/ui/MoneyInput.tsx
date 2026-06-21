import { moneyDisplay, parseMoneyInput } from '../../lib/format';

/** Campo de moeda amigável: mostra "R$" fixo e formata enquanto digita.
 *  value/onChange trabalham com número em REAIS (ex.: 12.5). */
export function MoneyInput({ value, onChange, ...rest }: {
  value: number;
  onChange: (v: number) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-mut)', fontWeight: 600, fontSize: 'var(--fs-sm)', pointerEvents: 'none' }}>R$</span>
      <input
        {...rest}
        className="input"
        style={{ paddingLeft: 38, textAlign: 'right' }}
        inputMode="numeric"
        value={moneyDisplay(value)}
        onChange={(e) => onChange(parseMoneyInput(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </div>
  );
}
