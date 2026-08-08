import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, setToken } from '../../api/client';
import { useTheme } from '../../theme/ThemeProvider';

/** Tela de login tematizada por tenant (UX §5.1 / FR10). */
export function LoginPage() {
  const { branding, tenant, loading } = useTheme();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const name = branding.display_name || 'DISTOK';

  // tenant suspenso/inativo => bloqueio (UX §5.1)
  if (tenant && tenant.status !== 'active') {
    return (
      <AuthLayout name={name}>
        <div className="auth-card card card-pad-lg" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: 'var(--sp-2)' }}>Acesso suspenso</h2>
          <p className="muted">Fale com o administrador da sua distribuidora para reativar o acesso.</p>
        </div>
      </AuthLayout>
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
    <AuthLayout name={name}>
      <form className="auth-card card card-pad-lg" onSubmit={onSubmit}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={name} style={{ maxHeight: 52 }} />
          ) : (
            <h1 style={{ color: 'var(--color-primary)', fontSize: 'var(--fs-2xl)' }}>{loading ? '…' : name}</h1>
          )}
          <p className="muted mt-2">Entre na sua conta para continuar</p>
        </div>

        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" placeholder="voce@empresa.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required autoComplete="username" autoFocus />
        </div>
        <div className="field">
          <label htmlFor="pwd">Senha</label>
          <input id="pwd" className="input" type="password" placeholder="••••••••" value={pwd}
            onChange={(e) => setPwd(e.target.value)} required autoComplete="current-password" />
        </div>

        {error && <div className="error-text" role="alert">{error}</div>}

        <button className="btn btn-primary btn-block mt-4" type="submit" disabled={submitting}>
          {submitting ? <><span className="spin" style={{ borderTopColor: 'var(--on-primary)' }} /> Entrando…</> : 'Entrar'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          <Link to="/esqueci-senha" style={{ fontSize: 'var(--fs-sm)' }}>Esqueci minha senha</Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--sp-2)' }}>
          <Link to="/cadastro" style={{ fontSize: 'var(--fs-sm)' }}>Criar conta</Link>
        </div>
      </form>
    </AuthLayout>
  );
}

/** Layout split: painel da marca à esquerda, formulário à direita. */
export function AuthLayout({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <div className="auth">
      <div className="auth-aside">
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-xl)', letterSpacing: '-0.02em' }}>{name}</div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 32, lineHeight: 1.2, marginBottom: 'var(--sp-3)' }}>
            Controle total do seu estoque, em tempo real.
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.78)', maxWidth: 380 }}>
            Movimentações, saldo, relatórios e auditoria — tudo num só lugar, com a cara da sua distribuidora.
          </p>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 'var(--fs-xs)' }}>
          © {new Date().getFullYear()} {name}
        </div>
      </div>
      <div className="auth-main">{children}</div>
    </div>
  );
}
