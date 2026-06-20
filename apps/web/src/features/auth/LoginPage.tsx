import { useState, FormEvent, ReactNode } from 'react';
import { api, setToken } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';

/** Tela de login tematizada por tenant (UX §5.1 / FR10). */
export function LoginPage() {
  const { branding, tenant, loading } = useTheme();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // tenant suspenso/inativo => bloqueio (UX §5.1)
  if (tenant && tenant.status !== 'active') {
    return (
      <Centered>
        <div className="card" style={{ textAlign: 'center', maxWidth: 380 }}>
          <p>Acesso suspenso. Fale com o administrador da sua distribuidora.</p>
        </div>
      </Centered>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password: pwd,
        tenantSlug: tenant?.slug,
      });
      setToken(data.token);
      window.location.href = data.mustChangePassword ? '/trocar-senha' : '/';
    } catch (err: any) {
      const code = err.response?.data?.error?.code;
      setError(
        code === 'TENANT_INACTIVE'
          ? 'Acesso bloqueado: distribuidora inativa.'
          : 'E-mail ou senha inválidos.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Centered>
      <form className="card" style={{ width: 380, maxWidth: '90vw' }} onSubmit={onSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          {branding.logo_url ? (
            <img src={branding.logo_url} alt="logo" style={{ maxHeight: 56 }} />
          ) : (
            <h1 style={{ color: 'var(--color-primary)', margin: 0 }}>
              {loading ? '...' : branding.display_name || 'DISTOK'}
            </h1>
          )}
          <p style={{ color: 'var(--color-text-mut)', marginTop: 'var(--sp-2)' }}>
            Bem-vindo{branding.display_name ? ` à ${branding.display_name}` : ''}
          </p>
        </div>

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div className="field">
          <label htmlFor="pwd">Senha</label>
          <input id="pwd" className="input" type="password" value={pwd}
            onChange={(e) => setPwd(e.target.value)} required autoComplete="current-password" />
        </div>

        {error && <div className="error-text" role="alert">{error}</div>}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--sp-4)' }}
          type="submit" disabled={submitting}>
          {submitting ? 'Entrando...' : 'Entrar'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          <a href="/esqueci-senha" style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-sm)' }}>
            Esqueci minha senha →
          </a>
        </div>
      </form>
    </Centered>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)' }}>
      {children}
    </div>
  );
}
