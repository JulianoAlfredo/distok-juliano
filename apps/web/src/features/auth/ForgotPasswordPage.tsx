import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';
import { AuthLayout } from './LoginPage';

/** Solicitação de redefinição de senha (resposta sempre neutra — AC9). */
export function ForgotPasswordPage() {
  const { branding, tenant } = useTheme();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const name = branding.display_name || 'DISTOK';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/auth/forgot', { email, tenantSlug: tenant?.slug });
    } catch {
      /* resposta neutra: não revela existência da conta */
    } finally {
      setSent(true);
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout name={name}>
      <div className="auth-card card card-pad-lg">
        {sent ? (
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--sp-2)' }}>Verifique seu e-mail</h2>
            <p className="muted">
              Se houver uma conta para <strong>{email}</strong>, enviamos um link para redefinir a senha (válido por 1 hora).
            </p>
            <Link to="/login" className="btn btn-block mt-6">Voltar para o login</Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <h2 style={{ marginBottom: 'var(--sp-1)' }}>Recuperar senha</h2>
            <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </p>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input id="email" className="input" type="email" placeholder="voce@empresa.com" value={email}
                onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button className="btn btn-primary btn-block mt-2" disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar link de recuperação'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
              <Link to="/login" style={{ fontSize: 'var(--fs-sm)' }}>Voltar para o login</Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
