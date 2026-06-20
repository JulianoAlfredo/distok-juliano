import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';

type Emp = {
  id: string;
  name: string;
  email: string;
  role_title: string | null;
  role: 'admin' | 'operator';
  status: string;
};

const EMPTY = { name: '', email: '', cpf: '', role_title: '', role: 'operator' };

export function UsersPage() {
  const { t } = useTheme();
  const [items, setItems] = useState<Emp[]>([]);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await api.get('/users');
    setItems(data);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setMsg(null);
    try {
      await api.post('/users', form);
      setForm(null);
      await load();
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message || 'Erro ao salvar.');
    }
  }

  async function toggleStatus(emp: Emp) {
    const next = emp.status === 'active' ? 'inactive' : 'active';
    await api.patch(`/users/${emp.id}/status`, { status: next });
    await load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ marginTop: 0 }}>{t('employee')}s</h2>
        <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}>+ Novo {t('employee').toLowerCase()}</button>
      </div>

      {msg && <div className="error-text">{msg}</div>}

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
          <h3 style={{ marginTop: 0 }}>Novo {t('employee').toLowerCase()}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
            <Field label="Nome completo*"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="E-mail*"><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="CPF"><input className="input" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Field>
            <Field label="Cargo"><input className="input" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></Field>
            <Field label="Nível de acesso">
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="operator">Operador</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          <p style={{ color: 'var(--color-text-mut)', fontSize: 'var(--fs-sm)' }}>
            Uma senha temporária será enviada por e-mail; a troca é obrigatória no 1º acesso.
          </p>
          <button className="btn btn-primary" onClick={save}>Criar acesso</button>
          <button className="btn" style={{ marginLeft: 'var(--sp-2)', border: '1px solid var(--color-border)' }} onClick={() => setForm(null)}>Cancelar</button>
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? <div style={{ padding: 'var(--sp-6)' }}>Carregando...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                <Th>Nome</Th><Th>E-mail</Th><Th>Cargo</Th><Th>Acesso</Th><Th>Status</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <Td>{u.name}</Td>
                  <Td>{u.email}</Td>
                  <Td>{u.role_title || '—'}</Td>
                  <Td>{u.role === 'admin' ? 'Admin' : 'Operador'}</Td>
                  <Td>{u.status === 'active' ? '🟢 ativo' : '⚪ inativo'}</Td>
                  <Td>
                    <button className="btn" style={{ border: '1px solid var(--color-border)', padding: '4px 8px' }} onClick={() => toggleStatus(u)}>
                      {u.status === 'active' ? 'Inativar' : 'Reativar'}
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="field" style={{ margin: 0 }}><label>{label}</label>{children}</div>;
}
function Th({ children }: { children?: React.ReactNode }) { return <th style={{ padding: 'var(--sp-3)' }}>{children}</th>; }
function Td({ children }: { children?: React.ReactNode }) { return <td style={{ padding: 'var(--sp-3)' }}>{children}</td>; }
