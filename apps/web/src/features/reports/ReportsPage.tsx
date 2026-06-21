import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { IconReport, IconDownload } from '../../components/ui/icons';

type ReportType = 'stock-current' | 'movements' | 'audit' | 'below-min';

const TYPES: { key: ReportType; label: string; desc: string; hasFilters?: boolean }[] = [
  { key: 'stock-current', label: 'Estoque atual', desc: 'Saldo de todos os itens' },
  { key: 'movements', label: 'Movimentações', desc: 'Entradas, saídas e ajustes', hasFilters: true },
  { key: 'audit', label: 'Auditoria', desc: 'Trilha de ações do sistema', hasFilters: true },
  { key: 'below-min', label: 'Abaixo do mínimo', desc: 'Itens que precisam de reposição' },
];

export function ReportsPage() {
  const toast = useToast();
  const [type, setType] = useState<ReportType>('stock-current');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [csvEnabled, setCsvEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/branding').then(({ data }) => setCsvEnabled(!!data.plan?.features?.csv)).catch(() => {});
  }, []);

  const current = TYPES.find((tp) => tp.key === type)!;

  async function download(format: 'pdf' | 'csv') {
    setBusy(true);
    try {
      const params: any = { format };
      if (current.hasFilters) { if (from) params.from = from; if (to) params.to = to; }
      const res = await api.get(`/reports/${type}`, { params, responseType: 'blob' });
      const blob = new Blob([res.data], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${type}.${format}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.push('Relatório gerado.', 'success');
    } catch {
      toast.push(format === 'csv' && !csvEnabled ? 'Exportação CSV disponível no plano Pro.' : 'Falha ao gerar relatório.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Gere documentos branded em PDF ou CSV" />

      <div className="card" style={{ maxWidth: 720 }}>
        <div className="label">Tipo de relatório</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
          {TYPES.map((tp) => {
            const active = type === tp.key;
            return (
              <button key={tp.key} onClick={() => setType(tp.key)} className="rep-card" style={{
                textAlign: 'left', cursor: 'pointer', font: 'inherit',
                border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: active ? 'var(--primary-softer)' : 'var(--color-surface)',
                borderRadius: 'var(--radius-md)', padding: 'var(--sp-3) var(--sp-4)', transition: 'all var(--t-fast)',
              }}>
                <div style={{ fontWeight: 600, color: active ? 'var(--color-primary)' : 'var(--color-text)' }}>{tp.label}</div>
                <div className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{tp.desc}</div>
              </button>
            );
          })}
        </div>

        {current.hasFilters && (
          <div className="grid-2" style={{ maxWidth: 420, marginBottom: 'var(--sp-5)' }}>
            <div className="field" style={{ margin: 0 }}><label>De</label><input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label>Até</label><input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        )}

        <div className="row">
          <button className="btn btn-primary" disabled={busy} onClick={() => download('pdf')}><IconDownload width={16} height={16} /> Gerar PDF</button>
          <button className="btn" disabled={busy || !csvEnabled} title={csvEnabled ? '' : 'Disponível no plano Pro'} onClick={() => download('csv')}>
            <IconReport width={16} height={16} /> Gerar CSV {csvEnabled ? '' : '🔒'}
          </button>
        </div>
        {!csvEnabled && <div className="field-hint mt-4">A exportação CSV está disponível no plano Pro.</div>}
      </div>
    </div>
  );
}
