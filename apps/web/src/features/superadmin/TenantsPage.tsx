import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type Tenant = {
  id: string;
  name: string;
  slug: string;
  cnpj: string;
  status: string;
  plan_code: string;
  plan_name: string;
};
type Metrics = { tenants: number; active: number; mrr: number; byPlan: { plan: string; count: number }[] };

const EMPTY = { name: '', cnpj: '', slug: '', address: '', planCode: 'basic', adminName: '', adminEmail: '' };

export function TenantsPage() {
  const [items, setItems] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    const [t, m] = await Promise.all([
      api.get('/admin/tenants', { params: { status: statusFilter || undefined } }),
      api.get('/admin/metrics'),
    ]);
    setItems(t.data);
    setMetrics(m.data);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  async function create() {
    setMsg(null);
    try {
      await api.post('/admin/tenants', form);
      setForm(null);
      setMsg({ ok: true, text: 'Distribuidora criada! Credenciais enviadas ao admin por e-mail.' });
      await load();
    } catch (e: any) {
      setMsg({ ok: false, text: e.response?.data?.error?.message || 'Erro ao criar.' });
    }
  }

  async function setStatus(id: string, status: string) {
    await api.patch(`/admin/tenants/${id}/status`, { status });
    await load();
  }

  async function resetPwd(id: string) {
    if (!confirm('Resetar a senha do admin desta distribuidora?')) return;
    await api.post(`/admin/tenants/${id}/reset-admin-password`);
    setMsg({ ok: true, text: 'Senha temporária enviada ao admin por e-mail.' });
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Distribuidoras</h2>

      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
          <Stat label="Tenants" value={String(metrics.tenants)} />
          <Stat label="Ativos" value={String(metrics.active)} />
          <Stat label="MRR estimado" value={`R$ ${metrics.mrr.toFixed(2)}`} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
        <select className="input" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="suspended">Suspensos</option>
          <option value="inactive">Inativos</option>
        </select>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Nova distribuidora</button>
      </div>

      {msg && <div style={{ color: msg.ok ? 'var(--color-success)' : 'var(--color-danger)', marginBottom: 'var(--sp-3)' }}>{msg.text}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 style={{ marginTop: 0 }}>Nova distribuidora</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <F label="Nome*"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="CNPJ*"><input className="input" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></F>
            <F label="Slug (subdomínio)*"><input className="input" value={form.slug} placeholder="ex: bebidassul" onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></F>
            <F label="Plano"><select className="input" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}><option value="basic">Básico</option><option value="pro">Pro</option></select></F>
            <F label="Nome do admin*"><input className="input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></F>
            <F label="E-mail do admin*"><input className="input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></F>
          </div>
          <button className="btn btn-primary" onClick={create}>Criar</button>
          <button className="btn" style={{ marginLeft: 'var(--sp-2)', border: '1px solid var(--color-border)' }} onClick={() => setForm(null)}>Cancelar</button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
            <Th>Distribuidora</Th><Th>CNPJ</Th><Th>Plano</Th><Th>Status</Th><Th>Ações</Th>
          </tr></thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <Td>{t.name} <span style={{ color: 'var(--color-text-mut)' }}>· {t.slug}</span></Td>
                <Td>{t.cnpj}</Td>
                <Td>{t.plan_name}</Td>
                <Td>{t.status === 'active' ? '🟢 ativo' : t.status === 'suspended' ? '🟠 suspenso' : '⚪ inativo'}</Td>
                <Td>
                  {t.status === 'active'
                    ? <Mini onClick={() => setStatus(t.id, 'suspended')}>Suspender</Mini>
                    : <Mini onClick={() => setStatus(t.id, 'active')}>Ativar</Mini>}
                  <Mini onClick={() => resetPwd(t.id)}>Resetar senha</Mini>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="card" style={{ padding: 'var(--sp-4)' }}><div style={{ color: 'var(--color-text-mut)', fontSize: 'var(--fs-sm)' }}>{label}</div><div style={{ fontSize: 'var(--fs-xl)', fontWeight: 700 }}>{value}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field" style={{ margin: 0 }}><label>{label}</label>{children}</div>; }
function Th({ children }: { children?: React.ReactNode }) { return <th style={{ padding: 'var(--sp-3)' }}>{children}</th>; }
function Td({ children }: { children?: React.ReactNode }) { return <td style={{ padding: 'var(--sp-3)' }}>{children}</td>; }
function Mini({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button className="btn" style={{ border: '1px solid var(--color-border)', padding: '4px 8px', marginRight: 4 }} onClick={onClick}>{children}</button>;
}
