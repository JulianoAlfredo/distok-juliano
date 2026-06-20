'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!env.mail.host) {
    // Sem SMTP configurado: modo "log" (dev). Não quebra o fluxo de onboarding.
    transporter = {
      sendMail: async (msg) => {
        console.log('[mailer:dev] e-mail não enviado (SMTP ausente):', {
          to: msg.to,
          subject: msg.subject,
        });
        return { messageId: 'dev-noop' };
      },
    };
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.port === 465,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, html, from }) {
  return getTransporter().sendMail({ from: from || env.mail.from, to, subject, html });
}

module.exports = { sendMail };
