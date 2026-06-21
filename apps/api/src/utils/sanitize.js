'use strict';

/** Escapa texto para interpolação segura em HTML (e-mails) — previne HTML/XSS injection. */
function htmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Aceita apenas URLs http(s) ou caminhos relativos (bloqueia javascript:, data:, etc.). */
function isSafeHttpUrl(u) {
  if (!u) return false;
  try {
    const parsed = new URL(u, 'http://local');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

module.exports = { htmlEscape, isSafeHttpUrl };
