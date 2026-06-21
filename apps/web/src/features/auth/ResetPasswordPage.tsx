import { useState, FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './LoginPage';

/** Redefinição de senha via token enviado por e-mail. */
export function ResetPasswordPage() {
  const { branding } = useTheme();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const name = branding.display_name || 'DISTOK';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError('A senha deve ter ao menos 8 caracteres.');
    if (next !== confirm) return setError('As senhas não conferem.');
    setSubmitting(true);
    try {
      await api.post('/auth/reset', { token, newPassword: next });
      setOk(true);
      setTimeout(() => (window.location.href = '/login'), 1400);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message;
      setError(msg || 'Não foi possível redefinir. O link pode ter expirado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout name={name}>
      <div className="auth-card card card-pad-lg">
        {!token ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--sp-2)' }}>Link inválido</h2>
            <p className="muted">O link de redefinição está incompleto ou expirado.</p>
            <Link to="/esqueci-senha" className="btn btn-block mt-6">Solicitar novo link</Link>
          </div>
        ) : ok ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--sp-2)' }}>✓ Senha redefinida</h2>
            <p className="muted">Você já pode entrar com a nova senha. Redirecionando…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <h2 style={{ marginBottom: 'var(--sp-1)' }}>Criar nova senha</h2>
            <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>Defina a nova senha da sua conta.</p>
            <div className="field">
              <label>Nova senha</label>
              <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoFocus />
              <div className="field-hint">Mínimo de 8 caracteres</div>
            </div>
            <div className="field">
              <label>Confirmar nova senha</label>
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </div>
            {error && <div className="error-text" role="alert">{error}</div>}
            <button className="btn btn-primary btn-block mt-4" disabled={submitting}>
              {submitting ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
