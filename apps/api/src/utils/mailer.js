'use strict';

const { Resend } = require('resend');
const env = require('../config/env');

let client = null;

function getClient() {
  if (client) return client;
  if (!env.mail.resendApiKey) {
    // Sem chave configurada: modo "log" (dev). Não quebra o fluxo de onboarding/testes.
    client = {
      emails: {
        send: async (msg) => {
          console.log('[mailer:dev] e-mail não enviado (RESEND_API_KEY ausente):', { to: msg.to, subject: msg.subject });
          return { data: { id: 'dev-noop' }, error: null };
        },
      },
    };
    return client;
  }
  client = new Resend(env.mail.resendApiKey);
  return client;
}

async function sendMail({ to, subject, html, from }) {
  const { error } = await getClient().emails.send({
    from: from || env.mail.from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });
  if (error) throw new Error(`Falha ao enviar e-mail via Resend: ${error.message || error}`);
}

module.exports = { sendMail };
