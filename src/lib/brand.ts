/** Cores da marca do assinante: derivações para o tema */
const toRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (r: number[]) => "#" + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
export function luminance(h: string) { const [r, g, b] = toRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
export const contrast = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
export const isHex = (c?: string | null) => !!c && /^#[0-9a-fA-F]{6}$/.test(c);

/** CSS que troca o verde do sistema pela cor da marca */
export function brandCss(color?: string | null) {
  if (!isHex(color)) return "";
  const c = color!;
  // garante leitura sobre o fundo escuro: clareia cores muito escuras
  const accent = contrast(c, "#151517") < 3 ? mix(c, "#ffffff", 0.35) : c;
  const on = luminance(accent) > 0.35 ? "#0c0c0d" : "#ffffff";
  return `:root{--color-mint:${accent};--color-mint-dim:${mix(accent, "#0c0c0d", 0.6)};--color-on-mint:${on};--color-mint-hover:${mix(accent, "#ffffff", 0.18)}}`;
}
export const PRESETS = ["#6eefb6", "#7aa7ff", "#f5c84c", "#ff6b6b", "#c084fc", "#fb923c", "#22d3ee", "#a3e635", "#f472b6", "#e5e5e5"];
