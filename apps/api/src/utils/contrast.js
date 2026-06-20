'use strict';

/**
 * Cálculo de contraste WCAG 2.1 (design/ux §3.3, NFR21).
 * Usado para validar que o tema do tenant mantém legibilidade.
 */

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isHex(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.substring(0, 2), 16),
    g: parseInt(c.substring(2, 4), 16),
    b: parseInt(c.substring(4, 6), 16),
  };
}

/** Luminância relativa (WCAG). */
function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razão de contraste entre duas cores (1..21). */
function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const WHITE = '#FFFFFF';
const BLACK = '#0F172A';

/** Melhor cor de texto (branco/preto) sobre um fundo + a razão obtida. */
function bestTextOn(hexBg) {
  const onWhite = contrastRatio(hexBg, WHITE);
  const onBlack = contrastRatio(hexBg, BLACK);
  return onWhite >= onBlack
    ? { text: WHITE, ratio: onWhite }
    : { text: BLACK, ratio: onBlack };
}

/**
 * Uma cor primária é "legível" se existir texto (branco ou preto) com
 * contraste >= 4.5:1 (AA para texto normal) sobre ela.
 */
function isPrimaryLegible(hexBg) {
  return bestTextOn(hexBg).ratio >= 4.5;
}

module.exports = {
  isHex,
  relativeLuminance,
  contrastRatio,
  bestTextOn,
  isPrimaryLegible,
  AA_NORMAL: 4.5,
};
