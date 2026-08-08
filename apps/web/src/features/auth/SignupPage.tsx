import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { maskCNPJ, slugify } from '../../lib/format';
import { AuthLayout } from './LoginPage';

/** Signup público self-service — cria a distribuidora e o admin sem depender de ninguém. */
export function SignupPage() {
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setName(v: string) {
    setCompanyName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (adminPassword.length < 8) return setError('A senha deve ter ao menos 8 caracteres.');
    setSubmitting(true);
    try {
      await api.post('/public/signup', { companyName, cnpj, slug, adminName, adminEmail, adminPassword });
      navigate('/cadastro/confirmar', { state: { email: adminEmail } });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Não foi possível criar sua conta. Verifique os dados.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout name="DISTOK">
      <form className="auth-card card card-pad-lg" onSubmit={onSubmit}>
        <h2 style={{ marginBottom: 'var(--sp-1)' }}>Crie sua conta</h2>
        <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
          Cadastre sua distribuidora e comece a usar o DISTOK agora.
        </p>

        <div className="field">
          <label>Nome da empresa</label>
          <input className="input" value={companyName} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label>CNPJ</label>
          <input className="input" value={cnpj} onChange={(e) => setCnpj(maskCNPJ(e.target.value))} inputMode="numeric" required />
        </div>
        <div className="field">
          <label>Endereço (subdomínio)</label>
          <input className="input" value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} placeholder="ex: distribuidorasol" />
        </div>
        <div className="field">
          <label>Seu nome</label>
          <input className="input" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Seu e-mail</label>
          <input className="input" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required autoComplete="username" />
        </div>
        <div className="field">
          <label>Crie uma senha</label>
          <input className="input" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required autoComplete="new-password" />
          <div className="field-hint">Mínimo de 8 caracteres</div>
        </div>

        {error && <div className="error-text" role="alert">{error}</div>}

        <button className="btn btn-primary btn-block mt-4" type="submit" disabled={submitting}>
          {submitting ? 'Criando conta…' : 'Criar minha conta'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 'var(--sp-4)' }}>
          <Link to="/login" style={{ fontSize: 'var(--fs-sm)' }}>Já tenho conta — entrar</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
