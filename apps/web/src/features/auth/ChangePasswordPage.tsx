import { useState, FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { api, getToken } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './LoginPage';

/** Troca de senha obrigatória no 1º acesso (FR44 / Story 1.3 AC8). */
export function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const { branding } = useTheme();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const name = branding.display_name || 'DISTOK';

  // guards: precisa estar logado; se já não precisa trocar, volta pra home
  if (!getToken()) return <Navigate to="/login" replace />;
  if (!loading && user && !user.mustChangePassword) return <Navigate to="/" replace />;

  const strong = next.length >= 8;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError('A nova senha deve ter ao menos 8 caracteres.');
    if (next !== confirm) return setError('As senhas não conferem.');
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setOk(true);
      setTimeout(() => (window.location.href = '/'), 1100);
    } catch {
      setError('Não foi possível trocar a senha. Verifique a senha atual.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout name={name}>
      <form className="auth-card card card-pad-lg" onSubmit={onSubmit}>
        <h2 style={{ marginBottom: 'var(--sp-1)' }}>Crie uma nova senha</h2>
        <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
          Por segurança, defina uma senha nova para o seu primeiro acesso.
        </p>
        <div className="field">
          <label>Senha atual (temporária)</label>
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>Nova senha</label>
          <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
          <div className="field-hint" style={{ color: next && !strong ? 'var(--color-danger)' : undefined }}>
            Mínimo de 8 caracteres {next && strong ? '✓' : ''}
          </div>
        </div>
        <div className="field">
          <label>Confirmar nova senha</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <div className="error-text" role="alert">{error}</div>}
        {ok && <div style={{ color: 'var(--color-success)', fontWeight: 600 }} role="status">✓ Senha alterada! Redirecionando…</div>}
        <button className="btn btn-primary btn-block mt-4" disabled={submitting || ok}>
          {submitting ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </AuthLayout>
  );
}
