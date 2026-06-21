import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader, StatusBadge, EmptyState } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { maskCNPJ, slugify } from '../../lib/format';
import { IconBuilding, IconPlus } from '../../components/ui/icons';

type Tenant = {
  id: string; name: string; slug: string; cnpj: string;
  status: string; plan_code: string; plan_name: string;
};
type Metrics = { tenants: number; active: number; mrr: number; byPlan: { plan: string; count: number }[] };

const EMPTY = { name: '', cnpj: '', slug: '', slugTouched: false, address: '', planCode: 'basic', adminName: '', adminEmail: '' };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function TenantsPage() {
  const toast = useToast();
  const confirm = useConfirm();
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

  // nome -> gera slug automaticamente (até o usuário editar o slug manualmente)
  function setName(name: string) {
    setForm((f: any) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }));
  }

  async function create() {
    if (!form.name.trim() || !form.adminEmail.trim()) return toast.push('Preencha ao menos o nome e o e-mail do administrador.', 'error');
    setSaving(true);
    try {
      const { slugTouched, ...payload } = form;
      await api.post('/admin/tenants', payload);
      setForm(null);
      toast.push('Distribuidora criada! As credenciais foram enviadas ao administrador.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar a distribuidora.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(t: Tenant, status: string) {
    if (status === 'suspended') {
      const ok = await confirm({ title: `Suspender "${t.name}"?`, message: 'Os usuários dessa distribuidora não conseguirão entrar até você reativar.', confirmText: 'Suspender', danger: true });
      if (!ok) return;
    }
    await api.patch(`/admin/tenants/${t.id}/status`, { status });
    toast.push(status === 'active' ? 'Distribuidora reativada.' : 'Distribuidora suspensa.', 'success');
    await load();
  }

  async function resetPwd(t: Tenant) {
    const ok = await confirm({ title: 'Resetar a senha do administrador?', message: `Uma nova senha temporária será enviada por e-mail ao admin de "${t.name}".`, confirmText: 'Resetar senha' });
    if (!ok) return;
    await api.post(`/admin/tenants/${t.id}/reset-admin-password`);
    toast.push('Senha temporária enviada por e-mail.', 'success');
  }

  return (
    <div>
      <PageHeader
        title="Distribuidoras"
        subtitle="Cadastre e gerencie as empresas que usam o sistema"
        actions={!form && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><IconPlus width={16} height={16} /> Nova distribuidora</button>}
      />

      {metrics && (
        <div className="stat-grid" style={{ marginBottom: 'var(--sp-6)' }}>
          <div className="stat"><div className="row-between"><span className="stat-label">Distribuidoras</span><span className="stat-ico"><IconBuilding /></span></div><div className="stat-value">{metrics.tenants}</div></div>
          <div className="stat"><div className="row-between"><span className="stat-label">Ativas</span></div><div className="stat-value">{metrics.active}</div></div>
          <div className="stat"><div className="row-between"><span className="stat-label">Receita mensal</span></div><div className="stat-value">{brl(metrics.mrr)}</div></div>
        </div>
      )}

      {form && (
        <div className="card mt-0" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-1)' }}>Nova distribuidora</h3>
          <p className="muted" style={{ marginBottom: 'var(--sp-4)', fontSize: 'var(--fs-sm)' }}>Crie a empresa e o primeiro administrador. Ele recebe a senha por e-mail.</p>
          <div className="grid-2">
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required>Nome da empresa</FieldLabel>
              <input className="input" placeholder="Ex.: Distribuidora Sol" value={form.name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required hint="Apenas números — a máscara é aplicada automaticamente.">CNPJ</FieldLabel>
              <input className="input" placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} inputMode="numeric" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Endereço web exclusivo da empresa. Geramos um para você a partir do nome — pode ajustar.">Endereço (subdomínio)</FieldLabel>
              <input className="input" placeholder="ex: distribuidorasol" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value), slugTouched: true })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Define limites e recursos disponíveis para a empresa.">Plano</FieldLabel>
              <select className="input" value={form.planCode} onChange={(e) => setForm({ ...form, planCode: e.target.value })}><option value="basic">Básico</option><option value="pro">Pro</option></select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required>Nome do administrador</FieldLabel>
              <input className="input" placeholder="Ex.: Maria Souza" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required hint="É para este e-mail que enviamos a senha de acesso.">E-mail do administrador</FieldLabel>
              <input className="input" type="email" placeholder="maria@empresa.com" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
            </div>
          </div>
          <div className="row mt-4">
            <button className="btn btn-primary" onClick={create} disabled={saving}>{saving ? 'Criando…' : 'Criar distribuidora'}</button>
            <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="row" style={{ marginBottom: 'var(--sp-4)' }}>
        <select className="input" style={{ maxWidth: 220 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todas as situações</option>
          <option value="active">Ativas</option>
          <option value="suspended">Suspensas</option>
          <option value="inactive">Inativas</option>
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconBuilding />} title="Nenhuma distribuidora" hint="Cadastre a primeira empresa para começar." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Empresa</th><th>CNPJ</th><th>Plano</th><th>Situação</th><th>Ações</th></tr></thead>
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
                        ? <button className="btn btn-sm" onClick={() => setStatus(t, 'suspended')}>Suspender</button>
                        : <button className="btn btn-sm" onClick={() => setStatus(t, 'active')}>Ativar</button>}
                      <button className="btn btn-sm" onClick={() => resetPwd(t)}>Resetar senha</button>
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
