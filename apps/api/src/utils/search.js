'use strict';

/**
 * Normaliza um termo de busca: trim, lowercase, remove diacríticos.
 * Usado para tornar buscas accent-insensitive mesmo em collations case-sensitive.
 */
function normalizeSearch(term) {
  if (!term) return '';
  return term
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Gera o padrão LIKE: `%termo%` com o termo normalizado.
 */
function likePattern(term) {
  return `%${normalizeSearch(term)}%`;
}

/**
 * Aplica busca accent-insensitive em múltiplas colunas via COLLATE utf8mb4_unicode_ci.
 * @param {import('knex').Knex.QueryBuilder} builder
 * @param {string} term - termo de busca
 * @param {string[]} columns - array de colunas no formato 'tabela.coluna'
 */
function applySearch(builder, term, columns) {
  if (!term || !columns.length) return builder;
  const pattern = likePattern(term);
  return builder.where((b) => {
    for (const col of columns) {
      b.orWhereRaw(`${col} COLLATE utf8mb4_unicode_ci LIKE ?`, [pattern]);
    }
  });
}

module.exports = { normalizeSearch, likePattern, applySearch };
