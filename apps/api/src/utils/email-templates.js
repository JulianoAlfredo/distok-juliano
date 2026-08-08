'use strict';

const { DEFAULT_BRANDING } = require('@distok/shared');
const { htmlEscape } = require('./sanitize');

const PRIMARY = DEFAULT_BRANDING.color_primary; // #2563EB
const SECONDARY = DEFAULT_BRANDING.color_secondary; // #1E293B

/** Envelope HTML único reaproveitado por todo e-mail transacional do DISTOK. */
function envelope({ title, bodyHtml }) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F1F5F9;font-family:Segoe UI,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr><td style="background:${SECONDARY};padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.5px;">DISTOK</span>
          </td></tr>
          <tr><td style="padding:32px;color:#1E293B;font-size:15px;line-height:1.6;">
            <h1 style="font-size:18px;margin:0 0 16px;color:#0F172A;">${htmlEscape(title)}</h1>
            ${bodyHtml}
          </td></tr>
          <tr><td style="padding:20px 32px;background:#F8FAFC;color:#64748B;font-size:12px;">
            Precisa de ajuda? <a href="mailto:suporte@distok.com.br" style="color:${PRIMARY};">suporte@distok.com.br</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function button(text, url) {
  return `<p style="margin:24px 0;"><a href="${url}" style="background:${PRIMARY};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block;">${htmlEscape(text)}</a></p>`;
}

function codeBlock(code) {
  return `<p style="margin:24px 0;text-align:center;"><span style="font-size:32px;font-weight:700;letter-spacing:8px;color:${SECONDARY};background:#F1F5F9;padding:16px 24px;border-radius:8px;display:inline-block;">${htmlEscape(code)}</span></p>`;
}

/** Credenciais de acesso (senha temporária) — usado em: novo funcionário, novo tenant, reset de senha do admin. */
function tempPasswordEmail({ name, email, tempPassword, loginUrl }) {
  return envelope({
    title: `Olá, ${htmlEscape(name)}!`,
    bodyHtml: `
      <p>Seu acesso ao DISTOK foi criado.</p>
      <p>Login: <b>${htmlEscape(email)}</b><br/>Senha temporária: <b>${htmlEscape(tempPassword)}</b></p>
      <p>No primeiro acesso você vai precisar criar uma nova senha.</p>
      ${loginUrl ? button('Acessar o DISTOK', loginUrl) : ''}
    `,
  });
}

/** Link de redefinição de senha (fluxo "esqueci minha senha"). */
function passwordResetLinkEmail({ name, link }) {
  return envelope({
    title: `Olá, ${htmlEscape(name)}!`,
    bodyHtml: `
      <p>Recebemos um pedido pra redefinir sua senha no DISTOK.</p>
      ${button('Redefinir senha', link)}
      <p style="color:#64748B;font-size:13px;">Se não foi você, ignore este e-mail — sua senha continua a mesma. O link expira em 1 hora.</p>
    `,
  });
}

/** Código numérico de confirmação — troca de e-mail, verificação de signup. */
function verificationCodeEmail({ name, code, context }) {
  return envelope({
    title: `Olá, ${htmlEscape(name)}!`,
    bodyHtml: `
      <p>${htmlEscape(context)}</p>
      ${codeBlock(code)}
      <p style="color:#64748B;font-size:13px;">O código expira em 15 minutos. Se não foi você, ignore este e-mail.</p>
    `,
  });
}

module.exports = { tempPasswordEmail, passwordResetLinkEmail, verificationCodeEmail };
