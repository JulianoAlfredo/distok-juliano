import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type ReportType = 'stock-current' | 'movements' | 'audit' | 'below-min';

const TYPES: { key: ReportType; label: string; hasFilters?: boolean }[] = [
  { key: 'stock-current', label: 'Estoque atual' },
  { key: 'movements', label: 'Movimentações', hasFilters: true },
  { key: 'audit', label: 'Auditoria', hasFilters: true },
  { key: 'below-min', label: 'Abaixo do mínimo' },
];

export function ReportsPage() {
  const [type, setType] = useState<ReportType>('stock-current');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [csvEnabled, setCsvEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get('/branding').then(({ data }) => setCsvEnabled(!!data.plan?.features?.csv)).catch(() => {});
  }, []);

  const current = TYPES.find((tp) => tp.key === type)!;

  async function download(format: 'pdf' | 'csv') {
    setBusy(true);
    setMsg(null);
    try {
      const params: any = { format };
      if (current.hasFilters) { if (from) params.from = from; if (to) params.to = to; }
      const res = await api.get(`/reports/${type}`, { params, responseType: 'blob' });
      const blob = new Blob([res.data], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setMsg(format === 'csv' && !csvEnabled ? 'Exportação CSV disponível no plano Pro.' : 'Falha ao gerar relatório.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Relatórios</h2>
      <div className="card">
        <div className="field">
          <label>Tipo de relatório</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {TYPES.map((tp) => (
              <button key={tp.key} className="btn"
                onClick={() => setType(tp.key)}
                style={{ border: '1px solid var(--color-border)', background: type === tp.key ? 'var(--color-primary)' : 'transparent', color: type === tp.key ? 'var(--on-primary)' : 'inherit' }}>
                {tp.label}
              </button>
            ))}
          </div>
        </div>

        {current.hasFilters && (
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <div className="field" style={{ margin: 0 }}><label>De</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label>Até</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        )}

        {msg && <div className="error-text" style={{ marginTop: 'var(--sp-3)' }}>{msg}</div>}

        <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => download('pdf')}>Gerar PDF</button>
          <button className="btn" disabled={busy || !csvEnabled}
            title={csvEnabled ? '' : 'Disponível no plano Pro'}
            style={{ border: '1px solid var(--color-border)' }}
            onClick={() => download('csv')}>
            Gerar CSV {csvEnabled ? '' : '🔒'}
          </button>
        </div>
      </div>
    </div>
  );
}
