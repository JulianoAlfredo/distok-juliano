'use strict';

const knex = require('../db/knex');
const env = require('../config/env');

/**
 * Resolve o tenant a partir da requisição (arch §6), por ordem:
 *  1. custom_domain (Host header bate com tenants.custom_domain)
 *  2. subdomínio: <slug>.distok.com.br
 *  3. querystring ?slug= / ?tenant= (fallback p/ dev e rota /public)
 *
 * Usado em endpoints públicos (tela de login) — NÃO substitui o isolamento
 * por JWT das rotas autenticadas.
 */
function extractSlugFromHost(host) {
  if (!host) return null;
  const hostname = host.split(':')[0].toLowerCase();
  const root = env.ROOT_DOMAIN.toLowerCase();
  if (hostname.endsWith('.' + root)) {
    const sub = hostname.slice(0, -(root.length + 1));
    // ignora subdomínios de plataforma
    if (sub && !['www', 'app', 'api'].includes(sub)) return sub;
  }
  return null;
}

async function resolveTenant(req) {
  const host = req.headers.host;

  // 1. domínio próprio
  if (host) {
    const hostname = host.split(':')[0].toLowerCase();
    const byDomain = await knex('tenants').where({ custom_domain: hostname }).first();
    if (byDomain) return byDomain;
  }

  // 2. subdomínio
  const subSlug = extractSlugFromHost(host);
  if (subSlug) {
    const bySub = await knex('tenants').where({ slug: subSlug }).first();
    if (bySub) return bySub;
  }

  // 3. querystring (dev / fallback)
  const slug = (req.query && (req.query.slug || req.query.tenant)) || null;
  if (slug) {
    const bySlug = await knex('tenants').where({ slug }).first();
    if (bySlug) return bySlug;
  }

  return null;
}

module.exports = { resolveTenant, extractSlugFromHost };
