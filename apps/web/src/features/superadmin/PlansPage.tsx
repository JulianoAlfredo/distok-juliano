import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type Plan = {
  id: string;
  code: string;
  name: string;
  price_cents: number;
  max_users: number | null;
  max_products: number | null;
  features: Record<string, boolean>;
};

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await api.get('/admin/plans');
    setPlans(data);
  }
  useEffect(() => { load(); }, []);

  async function save(p: Plan) {
    setMsg(null);
    try {
      await api.patch(`/admin/plans/${p.id}`, {
        name: p.name,
        price_cents: Number(p.price_cents),
        max_users: p.max_users === null ? null : Number(p.max_users),
        max_products: p.max_products === null ? null : Number(p.max_products),
        features: p.features,
      });
      setMsg('Plano atualizado.');
      await load();
    } catch {
      setMsg('Erro ao salvar plano.');
    }
  }

  function patch(idx: number, field: keyof Plan, value: any) {
    setPlans((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Planos</h2>
      {msg && <div style={{ color: 'var(--color-success)', marginBottom: 'var(--sp-3)' }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 'var(--sp-4)' }}>
        {plans.map((p, idx) => (
          <div key={p.id} className="card">
            <h3 style={{ marginTop: 0 }}>{p.name} <span style={{ color: 'var(--color-text-mut)', fontSize: 'var(--fs-sm)' }}>({p.code})</span></h3>
            <div className="field"><label>Mensalidade (centavos)</label><input className="input" type="number" value={p.price_cents} onChange={(e) => patch(idx, 'price_cents', e.target.value)} /></div>
            <div className="field"><label>Máx. usuários (vazio = ilimitado)</label><input className="input" type="number" value={p.max_users ?? ''} onChange={(e) => patch(idx, 'max_users', e.target.value === '' ? null : Number(e.target.value))} /></div>
            <div className="field"><label>Máx. produtos (vazio = ilimitado)</label><input className="input" type="number" value={p.max_products ?? ''} onChange={(e) => patch(idx, 'max_products', e.target.value === '' ? null : Number(e.target.value))} /></div>
            <div style={{ marginBottom: 'var(--sp-3)' }}>
              {['csv', 'terminology', 'customDomain', 'reportFooter'].map((f) => (
                <label key={f} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <input type="checkbox" checked={!!p.features?.[f]} onChange={(e) => patch(idx, 'features', { ...p.features, [f]: e.target.checked })} /> {f}
                </label>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => save(p)}>Salvar</button>
          </div>
        ))}
      </div>
    </div>
  );
}
