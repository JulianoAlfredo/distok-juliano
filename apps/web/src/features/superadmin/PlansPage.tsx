import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

type Plan = {
  id: string; code: string; name: string; price_cents: number;
  max_users: number | null; max_products: number | null; features: Record<string, boolean>;
};

const FEATURE_LABELS: Record<string, string> = {
  csv: 'Exportação CSV',
  terminology: 'Terminologia personalizada',
  customDomain: 'Domínio próprio',
  reportFooter: 'Rodapé em relatórios',
};

export function PlansPage() {
  const toast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get('/admin/plans');
    setPlans(data);
  }
  useEffect(() => { load(); }, []);

  async function save(p: Plan) {
    setSavingId(p.id);
    try {
      await api.patch(`/admin/plans/${p.id}`, {
        name: p.name,
        price_cents: Number(p.price_cents),
        max_users: p.max_users === null ? null : Number(p.max_users),
        max_products: p.max_products === null ? null : Number(p.max_products),
        features: p.features,
      });
      toast.push('Plano atualizado.', 'success');
      await load();
    } catch {
      toast.push('Erro ao salvar plano.', 'error');
    } finally {
      setSavingId(null);
    }
  }

  function patch(idx: number, field: keyof Plan, value: any) {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  return (
    <div>
      <PageHeader title="Planos" subtitle="Preços, limites e recursos de cada plano" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--sp-5)' }}>
        {plans.map((p, idx) => (
          <div key={p.id} className="card">
            <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
              <h3>{p.name}</h3>
              <span className="badge badge-neutral">{p.code}</span>
            </div>
            <div className="field"><label>Mensalidade (centavos)</label><input className="input" type="number" value={p.price_cents} onChange={(e) => patch(idx, 'price_cents', e.target.value)} /><div className="field-hint">R$ {(Number(p.price_cents) / 100).toFixed(2)}/mês</div></div>
            <div className="grid-2">
              <div className="field"><label>Máx. usuários</label><input className="input" type="number" placeholder="ilimitado" value={p.max_users ?? ''} onChange={(e) => patch(idx, 'max_users', e.target.value === '' ? null : Number(e.target.value))} /></div>
              <div className="field"><label>Máx. produtos</label><input className="input" type="number" placeholder="ilimitado" value={p.max_products ?? ''} onChange={(e) => patch(idx, 'max_products', e.target.value === '' ? null : Number(e.target.value))} /></div>
            </div>
            <div className="label">Recursos</div>
            <div className="stack" style={{ gap: 'var(--sp-2)', marginBottom: 'var(--sp-4)' }}>
              {Object.keys(FEATURE_LABELS).map((f) => (
                <label key={f} className="row" style={{ gap: 'var(--sp-2)', cursor: 'pointer', fontSize: 'var(--fs-sm)' }}>
                  <input type="checkbox" checked={!!p.features?.[f]} onChange={(e) => patch(idx, 'features', { ...p.features, [f]: e.target.checked })} />
                  {FEATURE_LABELS[f]}
                </label>
              ))}
            </div>
            <button className="btn btn-primary btn-block" onClick={() => save(p)} disabled={savingId === p.id}>{savingId === p.id ? 'Salvando…' : 'Salvar plano'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
