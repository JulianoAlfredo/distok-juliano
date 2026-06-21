import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { IconUsers, IconPlus } from '../../components/ui/icons';

type Emp = {
  id: string; name: string; email: string;
  role_title: string | null; role: 'admin' | 'operator'; status: string;
};

const EMPTY = { name: '', email: '', cpf: '', role_title: '', role: 'operator' };

export function UsersPage() {
  const { t } = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<Emp[]>([]);
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const term = t('employee').toLowerCase();

  async function load() {
    setLoading(true);
    const { data } = await api.get('/users');
    setItems(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    try {
      await api.post('/users', form);
      setForm(null);
      toast.push('Acesso criado! Senha temporária enviada por e-mail.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Erro ao salvar.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(emp: Emp) {
    const next = emp.status === 'active' ? 'inactive' : 'active';
    await api.patch(`/users/${emp.id}/status`, { status: next });
    toast.push(next === 'active' ? 'Acesso reativado.' : 'Acesso inativado.', 'success');
    await load();
  }

  return (
    <div>
      <PageHeader
        title={`${t('employee')}s`}
        subtitle="Equipe e níveis de acesso da distribuidora"
        actions={!form && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><IconPlus width={16} height={16} /> Novo {term}</button>}
      />

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>Novo {term}</h3>
          <div className="grid-2">
            <Field label="Nome completo*"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="E-mail*"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="CPF"><input className="input" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Field>
            <Field label="Cargo"><input className="input" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></Field>
            <Field label="Nível de acesso">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="operator">Operador — lança movimentações</option>
                <option value="admin">Administrador — acesso total</option>
              </select>
            </Field>
          </div>
          <p className="muted mt-4" style={{ fontSize: 'var(--fs-sm)' }}>
            Uma senha temporária será enviada por e-mail; a troca é obrigatória no 1º acesso.
          </p>
          <div className="row mt-2">
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Criando…' : 'Criar acesso'}</button>
            <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconUsers />} title={`Nenhum ${term} cadastrado`} hint="Adicione membros da equipe e defina o acesso de cada um." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Acesso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td className="muted">{u.role_title || '—'}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-neutral'}`}>{u.role === 'admin' ? 'Admin' : 'Operador'}</span></td>
                  <td><StatusBadge status={u.status} /></td>
                  <td><button className="btn btn-sm" onClick={() => toggleStatus(u)}>{u.status === 'active' ? 'Inativar' : 'Reativar'}</button></td>
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
