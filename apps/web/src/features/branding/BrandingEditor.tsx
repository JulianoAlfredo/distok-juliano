import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { bestTextOn, isHex } from '../../theme/contrast';

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
  const [b, setB] = useState<Branding>(DEFAULTS);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [terms, setTerms] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
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
    setMsg(null);
    if (!isHex(b.color_primary)) return setMsg({ type: 'err', text: 'Cor primária inválida.' });
    if (!legible) return setMsg({ type: 'err', text: 'Cor primária com baixo contraste — ajuste para manter a legibilidade.' });
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
      setMsg({ type: 'ok', text: 'Marca salva! Recarregue para ver em todo o sistema.' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error?.message || 'Erro ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  async function saveTerminology() {
    setMsg(null);
    setSaving(true);
    try {
      await api.put('/branding/terminology', { terms });
      setMsg({ type: 'ok', text: 'Terminologia atualizada!' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error?.message || 'Erro ao salvar terminologia.' });
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
      setMsg({ type: 'ok', text: 'Logo enviado!' });
    } catch (e: any) {
      setMsg({ type: 'err', text: e.response?.data?.error?.message || 'Falha no upload.' });
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Marca &amp; Personalização</h2>
      {plan && (
        <p style={{ color: 'var(--color-text-mut)' }}>
          Plano atual: <strong>{plan.name}</strong>
        </p>
      )}
      {msg && (
        <div style={{ color: msg.type === 'ok' ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: 'var(--sp-4)' }} role="alert">
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
        {/* EDITOR */}
        <div className="card">
          <div className="field">
            <label>Nome do sistema</label>
            <input className="input" value={b.display_name || ''} onChange={(e) => set('display_name', e.target.value)} />
          </div>

          <div className="field">
            <label>Logo (PNG/JPG/SVG/WEBP, ≤ 512KB)</label>
            <input ref={fileRef} type="file" accept="image/*" onChange={uploadLogo} />
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <ColorField label="Primária" value={b.color_primary} onChange={(v) => set('color_primary', v)} />
            <ColorField label="Secundária" value={b.color_secondary} onChange={(v) => set('color_secondary', v)} />
            <ColorField label="Destaque" value={b.color_accent} onChange={(v) => set('color_accent', v)} />
          </div>

          <div style={{ marginTop: 'var(--sp-3)', fontSize: 'var(--fs-sm)', color: legible ? 'var(--color-success)' : 'var(--color-danger)' }}>
            Contraste do texto sobre a primária: {contrast.ratio.toFixed(1)}:1 {legible ? '✓ AA' : '✗ baixo'}
          </div>

          <div className="field" style={{ marginTop: 'var(--sp-4)' }}>
            <label>Rodapé dos relatórios {canFooter ? '' : '🔒 (Pro)'}</label>
            <input className="input" disabled={!canFooter} value={b.report_footer || ''} onChange={(e) => set('report_footer', e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={saveBranding} disabled={saving} style={{ marginTop: 'var(--sp-3)' }}>
            {saving ? 'Salvando...' : 'Salvar marca'}
          </button>
          <button className="btn" onClick={() => setB(DEFAULTS)} style={{ marginLeft: 'var(--sp-3)', border: '1px solid var(--color-border)' }}>
            Restaurar padrão DISTOK
          </button>

          <hr style={{ margin: 'var(--sp-6) 0', border: 0, borderTop: '1px solid var(--color-border)' }} />

          <h3>Terminologia {canTerminology ? '' : '🔒 (Pro)'}</h3>
          {TERMS.map((t) => (
            <div className="field" key={t.key}>
              <label>"{t.label}" vira</label>
              <input
                className="input"
                disabled={!canTerminology}
                value={terms[t.key] || ''}
                placeholder={t.label}
                onChange={(e) => setTerms((prev) => ({ ...prev, [t.key]: e.target.value }))}
              />
            </div>
          ))}
          {canTerminology && (
            <button className="btn btn-primary" onClick={saveTerminology} disabled={saving}>
              Salvar terminologia
            </button>
          )}
        </div>

        {/* PREVIEW AO VIVO */}
        <div>
          <div style={{ position: 'sticky', top: 'var(--sp-4)' }}>
            <p style={{ color: 'var(--color-text-mut)' }}>Pré-visualização</p>
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ background: b.color_secondary, color: '#fff', padding: 'var(--sp-3) var(--sp-4)', display: 'flex', justifyContent: 'space-between' }}>
                <strong>{b.logo_url ? <img src={b.logo_url} alt="logo" style={{ maxHeight: 24 }} /> : b.display_name}</strong>
                <span>👤</span>
              </div>
              <div style={{ padding: 'var(--sp-6)', background: 'var(--color-bg)' }}>
                <button style={{ background: b.color_primary, color: onPrimary, border: 'none', padding: 'var(--sp-3) var(--sp-4)', borderRadius: 'var(--radius-md)' }}>
                  Botão primário
                </button>
                <span style={{ display: 'inline-block', marginLeft: 'var(--sp-3)', background: b.color_accent, color: '#000', padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>
                  destaque
                </span>
                <p style={{ marginTop: 'var(--sp-4)' }}>
                  Exemplo de texto e <a style={{ color: b.color_primary }}>link tematizado</a>.
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
    <div className="field" style={{ flex: 1 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
        <input type="color" value={isHex(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
        <input className="input" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      </div>
    </div>
  );
}
