/** Contraste WCAG no cliente — feedback ao vivo no editor de marca (design §3.3). */
function luminance(hex: string): number {
  const c = hex.replace('#', '');
  if (c.length !== 6) return 0;
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = ch(parseInt(c.substring(0, 2), 16));
  const g = ch(parseInt(c.substring(2, 4), 16));
  const b = ch(parseInt(c.substring(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function bestTextOn(bg: string): { text: string; ratio: number } {
  const onWhite = contrastRatio(bg, '#FFFFFF');
  const onBlack = contrastRatio(bg, '#0F172A');
  return onWhite >= onBlack ? { text: '#FFFFFF', ratio: onWhite } : { text: '#0F172A', ratio: onBlack };
}

export const isHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
