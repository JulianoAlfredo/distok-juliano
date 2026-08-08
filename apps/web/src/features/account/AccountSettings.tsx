import { useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import { PageHeader } from '../../components/ui';
import { useToast } from '../../components/ui/Toast';

/** "Minha Conta" — troca de e-mail self-service (senha já tem sua própria tela). */
export function AccountSettings() {
  const { user, reload } = useAuth();
  const toast = useToast();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [submitting, setSubmitting] = useState(false);

  async function requestChange() {
    if (!newEmail || !currentPassword) return toast.push('Preencha o novo e-mail e a senha atual.', 'error');
    setSubmitting(true);
    try {
      await api.post('/auth/email-change/request', { newEmail, currentPassword });
      setStep('code');
      toast.push('Enviamos um código pro seu novo e-mail.', 'success');
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Não foi possível iniciar a troca de e-mail.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmChange() {
    if (code.length !== 6) return toast.push('Digite o código de 6 dígitos.', 'error');
    setSubmitting(true);
    try {
      await api.post('/auth/email-change/confirm', { code });
      toast.push('E-mail atualizado!', 'success');
      setStep('form');
      setNewEmail('');
      setCurrentPassword('');
      setCode('');
      await reload();
    } catch (e: any) {
      toast.push(e.response?.data?.error?.message || 'Código inválido ou expirado.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Minha Conta" subtitle="Dados de acesso da sua conta" />

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="field">
          <label>E-mail atual</label>
          <input className="input" value={user?.email || ''} disabled />
        </div>

        <hr style={{ margin: 'var(--sp-6) 0', border: 0, borderTop: '1px solid var(--color-border)' }} />

        <h3 style={{ marginBottom: 'var(--sp-3)' }}>Trocar e-mail</h3>

        {step === 'form' ? (
          <>
            <div className="field">
              <label>Novo e-mail</label>
              <input className="input" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="field">
              <label>Senha atual</label>
              <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={requestChange} disabled={submitting}>
              {submitting ? 'Enviando…' : 'Enviar código de confirmação'}
            </button>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 'var(--sp-3)' }}>
              Enviamos um código de 6 dígitos para <strong>{newEmail}</strong>.
            </p>
            <div className="field">
              <label>Código</label>
              <input
                className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" maxLength={6} placeholder="000000"
                style={{ letterSpacing: 8, fontSize: 20, textAlign: 'center' }}
              />
            </div>
            <div className="row" style={{ gap: 'var(--sp-2)' }}>
              <button className="btn btn-primary" onClick={confirmChange} disabled={submitting || code.length !== 6}>
                {submitting ? 'Confirmando…' : 'Confirmar novo e-mail'}
              </button>
              <button className="btn" onClick={() => setStep('form')}>Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
