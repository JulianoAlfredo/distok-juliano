import { useState, FormEvent } from 'react';
import { api } from '../../api/client';

/** Troca de senha obrigatória no 1º acesso (FR44 / Story 1.3 AC8). */
export function ChangePasswordPage() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError('A nova senha deve ter ao menos 8 caracteres.');
    if (next !== confirm) return setError('As senhas não conferem.');
    setSubmitting(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setOk(true);
      setTimeout(() => (window.location.href = '/'), 1200);
    } catch {
      setError('Não foi possível trocar a senha. Verifique a senha atual.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 'var(--sp-4)' }}>
      <form className="card" style={{ width: 400, maxWidth: '90vw' }} onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0 }}>Crie uma nova senha</h2>
        <p style={{ color: 'var(--color-text-mut)' }}>
          Por segurança, defina uma senha nova para o seu primeiro acesso.
        </p>
        <div className="field">
          <label>Senha atual (temporária)</label>
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label>Nova senha</label>
          <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="field">
          <label>Confirmar nova senha</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        {error && <div className="error-text" role="alert">{error}</div>}
        {ok && <div style={{ color: 'var(--color-success)' }}>✓ Senha alterada! Redirecionando...</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 'var(--sp-4)' }} disabled={submitting}>
          {submitting ? 'Salvando...' : 'Salvar nova senha'}
        </button>
      </form>
    </div>
  );
}
