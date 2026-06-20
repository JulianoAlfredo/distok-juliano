'use strict';

/** Gera CSV (UTF-8 com BOM p/ Excel) a partir de colunas e linhas. */
function escape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[";\n,]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(columns, rows) {
  const header = columns.map((c) => escape(c.label)).join(';');
  const body = rows
    .map((row) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.key])).join(';'))
    .join('\n');
  return '﻿' + header + '\n' + body + '\n';
}

module.exports = { toCSV };
