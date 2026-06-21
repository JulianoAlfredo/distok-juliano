import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { bestTextOn, isHex } from '../../theme/contrast';
import { PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

type Branding = {
  display_name: string | null;
  logo_url: string | null;
  color_primary: string;
  color_secondary: string;
  color_accent: string;
  report_footer: string | null;
};
type PlanInfo = { code: string; name: string; features: Record<string, boolean> };

const DEFAULTS: Branding = {
  display_name: 'DISTOK',
  logo_url: null,
  color_primary: '#2563EB',
  color_secondary: '#1E293B',
  color_accent: '#F59E0B',
  report_footer: null,
};

const TERMS = [
  { key: 'product', label: 'Produto' },
  { key: 'employee', label: 'Funcionário' },
  { key: 'company', label: 'Distribuidora' },
  { key: 'stock', label: 'Estoque' },
];

export function BrandingEditor() {
  const toast = useToast();
  const [b, setB] = useState<Branding>(DEFAULTS);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [terms, setTerms] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/branding').then(({ data }) => {
      setB({ ...DEFAULTS, ...data.branding });
      setPlan(data.plan);
      setTerms(data.terminology || {});
    });
  }, []);

  const canTerminology = !!plan?.features?.terminology;
  const canFooter = !!plan?.features?.reportFooter;
  const contrast = bestTextOn(b.color_primary);
  const legible = contrast.ratio >= 4.5;
  const onPrimary = contrast.text;

  function set<K extends keyof Branding>(k: K, v: Branding[K]) {
    setB((prev) => ({ ...prev, [k]: v }));
  }

  async function saveBranding() {
    if (!isHex(b.color_primary)) return toast.push('Cor primária inválida.', 'error');
    if (!legible) return toast.push('Cor primária com baixo contraste — ajuste para manter a legibilidade.', 'error');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        display_name: b.display_name,
        color_primary: b.color_primary,
        color_secondary: b.color_secondary,
        color_accent: b.color_accent,
      };
      if (canFooter) payload.report_footer = b.report_footer || '';
      await api.put('/branding', payload);
      toast.push('Marca salva! Recarregue para ver em todo o sistema.', 'success');
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveTerminology() {
    setSaving(true);
    try {
      await api.put('/branding/terminology', { terms });
      toast.push('Terminologia atualizada!', 'success');
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao salvar terminologia.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('field', 'logo');
    form.append('file', file);
    try {
      const { data } = await api.post('/branding/asset', form);
      set('logo_url', data.logo_url);
      toast.push('Logo enviado!', 'success');
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Falha no upload.', 'error');
    }
  }

  return (
    <div>
      <PageHeader
        title="Marca & Personalização"
        subtitle="Deixe o sistema com a identidade da sua distribuidora"
        actions={plan && <span className="badge badge-info">Plano {plan.name}</span>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--sp-6)' }}>
        {/* EDITOR */}
        <div className="card">
          <div className="field">
            <label>Nome do sistema</label>
            <input className="input" value={b.display_name || ''} onChange={(e) => set('display_name', e.target.value)} />
          </div>

          <div className="field">
            <label>Logo (PNG/JPG/SVG/WEBP, ≤ 512KB)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadLogo} className="input" style={{ padding: 8 }} />
          </div>

          <div className="row" style={{ gap: 'var(--sp-3)', alignItems: 'flex-end' }}>
            <ColorField label="Primária" value={b.color_primary} onChange={(v) => set('color_primary', v)} />
            <ColorField label="Secundária" value={b.color_secondary} onChange={(v) => set('color_secondary', v)} />
            <ColorField label="Destaque" value={b.color_accent} onChange={(v) => set('color_accent', v)} />
          </div>

          <div className={`badge ${legible ? 'badge-success' : 'badge-danger'} mt-4`}>
            Contraste {contrast.ratio.toFixed(1)}:1 {legible ? '— AA aprovado' : '— baixo, ajuste'}
          </div>

          <div className="field mt-4">
            <label>Rodapé dos relatórios {canFooter ? '' : '🔒 (Pro)'}</label>
            <input className="input" disabled={!canFooter} value={b.report_footer || ''} onChange={(e) => set('report_footer', e.target.value)} />
          </div>

          <div className="row mt-2">
            <button className="btn btn-primary" onClick={saveBranding} disabled={saving}>{saving ? 'Salvando…' : 'Salvar marca'}</button>
            <button className="btn" onClick={() => setB(DEFAULTS)}>Restaurar padrão</button>
          </div>

          <hr style={{ margin: 'var(--sp-6) 0', border: 0, borderTop: '1px solid var(--color-border)' }} />

          <h3 style={{ marginBottom: 'var(--sp-3)' }}>Terminologia {canTerminology ? '' : '🔒 (Pro)'}</h3>
          {TERMS.map((tm) => (
            <div className="field" key={tm.key}>
              <label>"{tm.label}" vira</label>
              <input className="input" disabled={!canTerminology} value={terms[tm.key] || ''} placeholder={tm.label}
                onChange={(e) => setTerms((prev) => ({ ...prev, [tm.key]: e.target.value }))} />
            </div>
          ))}
          {canTerminology && <button className="btn btn-primary" onClick={saveTerminology} disabled={saving}>Salvar terminologia</button>}
        </div>

        {/* PREVIEW AO VIVO */}
        <div>
          <div style={{ position: 'sticky', top: 'var(--sp-6)' }}>
            <div className="label">Pré-visualização ao vivo</div>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
              <div style={{ background: b.color_secondary, color: '#fff', padding: 'var(--sp-4) var(--sp-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{b.logo_url ? <img src={b.logo_url} alt="logo" style={{ maxHeight: 26 }} /> : b.display_name}</strong>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'grid', placeItems: 'center', fontSize: 13 }}>U</span>
              </div>
              <div style={{ padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
                <button style={{ background: b.color_primary, color: onPrimary, border: 'none', padding: '10px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                  Botão primário
                </button>
                <span style={{ display: 'inline-block', marginLeft: 'var(--sp-3)', background: b.color_accent, color: bestTextOn(b.color_accent).text, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                  destaque
                </span>
                <p className="mt-4">
                  Exemplo de texto com um <a style={{ color: b.color_primary, fontWeight: 600 }}>link tematizado</a> aplicado.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field" style={{ flex: 1, margin: 0 }}>
      <label>{label}</label>
      <div className="row" style={{ gap: 'var(--sp-2)' }}>
        <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())}
          style={{ width: 38, height: 40, padding: 2, border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-sm)', background: 'none', cursor: 'pointer' }} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} style={{ minWidth: 0 }} />
      </div>
    </div>
  );
}
