import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, StatusBadge, EmptyState } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { IconBuilding, IconPlus } from '../../components/ui/icons';

type Tenant = {
  id: string; name: string; slug: string; cnpj: string;
  status: string; plan_code: string; plan_name: string;
};
type Metrics = { tenants: number; active: number; mrr: number; byPlan: { plan: string; count: number }[] };

const EMPTY = { name: '', cnpj: '', slug: '', address: '', planCode: 'basic', adminName: '', adminEmail: '' };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TenantsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [form, setForm] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await api.post('/admin/tenants', form);
      setForm(null);
      toast.push('Distribuidora criada! Credenciais enviadas ao admin.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao criar distribuidora.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await api.patch(`/admin/tenants/${id}/status`, { status });
    toast.push(status === 'active' ? 'Distribuidora ativada.' : 'Distribuidora suspensa.', 'success');
    await load();
  }

  async function resetPwd(id: string) {
    if (!confirm('Resetar a senha do admin desta distribuidora?')) return;
    await api.post(`/admin/tenants/${id}/reset-admin-password`);
    toast.push('Senha temporária enviada ao admin por e-mail.', 'success');
  }

  return (
    <div>
      <PageHeader
        title="Distribuidoras"
        subtitle="Gerencie os clientes (tenants) da plataforma"
        actions={!form && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><IconPlus width={16} height={16} /> Nova distribuidora</button>}
      />

      {metrics && (
        <div className="stat-grid" style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="stat"><div className="row-between"><span className="stat-label">Distribuidoras</span><span className="stat-ico"><IconBuilding /></span></div><div className="stat-value">{metrics.tenants}</div></div>
          <div className="stat"><div className="row-between"><span className="stat-label">Ativas</span></div><div className="stat-value">{metrics.active}</div></div>
          <div className="stat"><div className="row-between"><span className="stat-label">MRR estimado</span></div><div className="stat-value">{brl(metrics.mrr)}</div></div>
        </div>
      )}

      {form && (
        <div className="card mt-0" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>Nova distribuidora</h3>
          <div className="grid-2">
            <Field label="Nome*"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="CNPJ*"><input className="input" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></Field>
            <Field label="Slug (subdomínio)*"><input className="input" value={form.slug} placeholder="ex: bebidassul" onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} /></Field>
            <Field label="Plano"><select className="input" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}><option value="basic">Básico</option><option value="pro">Pro</option></select></Field>
            <Field label="Nome do admin*"><input className="input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} /></Field>
            <Field label="E-mail do admin*"><input className="input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} /></Field>
          </div>
          <div className="row mt-4">
            <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Criando…' : 'Criar distribuidora'}</button>
            <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <select className="input" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
          <option value="inactive">Inativas</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconBuilding />} title="Nenhuma distribuidora" hint="Crie a primeira distribuidora para começar." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Distribuidora</th><th>CNPJ</th><th>Plano</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td><div style={{ fontWeight: 600 }}>{t.name}</div><div className="faint" style={{ fontSize: 'var(--fs-xs)' }}>{t.slug}</div></td>
                  <td className="muted">{t.cnpj}</td>
                  <td><span className="badge badge-neutral">{t.plan_name}</span></td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>
                    <div className="row" style={{ gap: 'var(--sp-2)' }}>
                      {t.status === 'active'
                        ? <button className="btn btn-sm" onClick={() => setStatus(t.id, 'suspended')}>Suspender</button>
                        : <button className="btn btn-sm" onClick={() => setStatus(t.id, 'active')}>Ativar</button>}
                      <button className="btn btn-sm" onClick={() => resetPwd(t.id)}>Resetar senha</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label>{children}</div>;
}
