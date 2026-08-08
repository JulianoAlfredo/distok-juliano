import { useState, FormEvent } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { api, setToken } from '../../api/client';
import { AuthLayout } from './LoginPage';

/** Passo 2 do signup: confirma o código de 6 dígitos enviado por e-mail. */
export function VerifyCodePage() {
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email;
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);

  if (!email) return <Navigate to="/cadastro" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/public/signup/verify', { email, code });
      setToken(data.token);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Código inválido ou expirado.');
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    try {
      await api.post('/public/signup/resend-code', { email });
      setResent(true);
    } catch {
      /* resposta neutra do backend — nada a mostrar de diferente */
      setResent(true);
    }
  }

  return (
    <AuthLayout name="DISTOK">
      <form className="auth-card card card-pad-lg" onSubmit={onSubmit}>
        <h2 style={{ marginBottom: 'var(--sp-1)' }}>Confirme seu e-mail</h2>
        <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
          Enviamos um código de 6 dígitos para <strong>{email}</strong>.
        </p>
        <div className="field">
          <label>Código</label>
          <input
            className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" maxLength={6} placeholder="000000" required autoFocus
            style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
          />
        </div>

        {error && <div className="error-text" role="alert">{error}</div>}
        {resent && <div style={{ color: 'var(--color-success)' }} role="status">Novo código enviado, se o e-mail existir.</div>}

        <button className="btn btn-primary btn-block mt-4" type="submit" disabled={submitting || code.length !== 6}>
          {submitting ? 'Confirmando…' : 'Confirmar'}
        </button>
        <button type="button" className="btn btn-block mt-2" onClick={resend}>Reenviar código</button>
      </form>
    </AuthLayout>
  );
}
