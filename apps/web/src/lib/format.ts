/** Utilidades de formatação/máscara — pensadas para usuários leigos (entrada guiada). */

export const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

/** Formata número (em reais) como moeda brasileira: 1234.5 -> "R$ 1.234,50". */
export const formatBRL = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Converte o texto digitado num input de moeda para número (reais).
 *  O usuário digita só números; tratamos os 2 últimos dígitos como centavos. */
export const parseMoneyInput = (raw: string): number => {
  const digits = onlyDigits(raw);
  if (!digits) return 0;
  return Number(digits) / 100;
};

/** Exibe um número (reais) no formato de digitação do input de moeda: "1.234,50". */
export const moneyDisplay = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Máscara de CNPJ: 00.000.000/0000-00 (aplica progressivamente). */
export const maskCNPJ = (v: string): string => {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
};

/** Máscara de CPF: 000.000.000-00. */
export const maskCPF = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
};

/** Gera um slug amigável a partir de um nome (para subdomínio do tenant). */
export const slugify = (v: string): string =>
  (v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 40);

/** Validação simples de CNPJ (14 dígitos) — só estrutura, não dígito verificador. */
export const isCnpjLike = (v: string) => onlyDigits(v).length === 14;

/** Máscara de telefone: (00) 0000-0000 ou (00) 00000-0000. */
export const maskPhone = (v: string): string => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
};
