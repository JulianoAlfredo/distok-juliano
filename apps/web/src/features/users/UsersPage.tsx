import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { PageHeader, StatusBadge, EmptyState, Loading } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';
import { useConfirm } from '../../components/ui/Confirm';
import { FieldLabel } from '../../components/ui/Hint';
import { maskCPF } from '../../lib/format';
import { IconUsers, IconPlus } from '../../components/ui/icons';

type Emp = {
  id: string; name: string; email: string;
  role_title: string | null; role: 'admin' | 'operator'; status: string;
};

const EMPTY = { name: '', email: '', cpf: '', role_title: '', role: 'operator' };

export function UsersPage() {
  const { t } = useTheme();
  const toast = useToast();
  const confirm = useConfirm();
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
    if (!form.name.trim() || !form.email.trim()) return toast.push('Preencha o nome e o e-mail.', 'error');
    setSaving(true);
    try {
      await api.post('/users', form);
      setForm(null);
      toast.push('Acesso criado! A senha temporária foi enviada por e-mail.', 'success');
      await load();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível criar o acesso.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(emp: Emp) {
    const next = emp.status === 'active' ? 'inactive' : 'active';
    if (next === 'inactive') {
      const ok = await confirm({ title: `Tirar o acesso de ${emp.name}?`, message: 'A pessoa não conseguirá mais entrar no sistema. Você pode reativar quando quiser.', confirmText: 'Tirar acesso', danger: true });
      if (!ok) return;
    }
    await api.patch(`/users/${emp.id}/status`, { status: next });
    toast.push(next === 'active' ? 'Acesso reativado.' : 'Acesso removido.', 'success');
    await load();
  }

  return (
    <div>
      <PageHeader
        title={`${t('employee')}s`}
        subtitle="Quem pode usar o sistema e o que cada um pode fazer"
        actions={!form && <button className="btn btn-primary" onClick={() => setForm({ ...EMPTY })}><IconPlus width={16} height={16} /> Novo {term}</button>}
      />

      {form && (
        <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>Novo {term}</h3>
          <div className="grid-2">
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required>Nome completo</FieldLabel>
              <input className="input" placeholder="Ex.: João da Silva" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel required hint="É para este e-mail que enviamos a senha de acesso.">E-mail</FieldLabel>
              <input className="input" type="email" placeholder="joao@empresa.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Opcional. Só números — a máscara é aplicada sozinha.">CPF</FieldLabel>
              <input className="input" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} inputMode="numeric" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <FieldLabel hint="Como a pessoa é chamada na empresa. Opcional.">Cargo</FieldLabel>
              <input className="input" placeholder="Ex.: Estoquista" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
            </div>
            <div className="field" style={{ margin: 0, gridColumn: '1 / -1' }}>
              <FieldLabel required>Nível de acesso</FieldLabel>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="operator">Operador — registra entradas e saídas de estoque</option>
                <option value="admin">Administrador — acesso total (produtos, equipe, relatórios)</option>
              </select>
              <div className="field-hint">
                {form.role === 'admin'
                  ? 'O administrador pode fazer tudo na empresa, inclusive cadastrar pessoas e ver relatórios.'
                  : 'O operador foca no dia a dia do estoque, sem acesso a configurações e relatórios.'}
              </div>
            </div>
          </div>
          <p className="muted mt-4" style={{ fontSize: 'var(--fs-sm)' }}>
            A pessoa recebe uma senha temporária por e-mail e cria a própria senha no primeiro acesso.
          </p>
          <div className="row mt-2">
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Criando…' : 'Criar acesso'}</button>
            <button className="btn" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {loading ? <Loading /> : items.length === 0 ? (
        <div className="card"><EmptyState icon={<IconUsers />} title={`Nenhum ${term} cadastrado`} hint="Adicione as pessoas da equipe e escolha o que cada uma pode fazer." /></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Nome</th><th>E-mail</th><th>Cargo</th><th>Acesso</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {items.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td className="muted">{u.role_title || '—'}</td>
                  <td><span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-neutral'}`}>{u.role === 'admin' ? 'Administrador' : 'Operador'}</span></td>
                  <td><StatusBadge status={u.status} /></td>
                  <td><button className="btn btn-sm" onClick={() => toggleStatus(u)}>{u.status === 'active' ? 'Tirar acesso' : 'Reativar'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
