/**
 * El yazısıyla tek çizgide "Zero". Hem terminal açılışında kalemle yazılır,
 * hem de bomba açılışında fitilin şeklidir. viewBox: 0 0 260 120.
 */
export const ZERO_D =
  'M16 34 C 30 22, 56 24, 72 27 C 58 46, 36 70, 18 92 C 34 82, 54 86, 70 92 C 82 96, 92 88, 100 78 ' +
  'C 112 76, 130 70, 130 60 C 130 48, 108 50, 104 68 C 100 86, 116 98, 136 86 C 144 80, 148 68, 150 56 ' +
  'C 152 62, 160 64, 170 59 C 176 56, 180 58, 180 66 C 178 78, 184 92, 198 88 C 190 78, 194 58, 210 56 ' +
  'C 226 54, 234 68, 230 80 C 226 94, 206 96, 198 88 C 206 80, 226 72, 244 70';

const NS = 'http://www.w3.org/2000/svg';
export const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
};
