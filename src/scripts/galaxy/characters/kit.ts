import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/**
 * Karakter gezegenler için ortak araç kutusu.
 * Her karakter: merkezi orijinde, ana gövde yarıçapı ~1, süsleri (halka, uydu, uçan şeyler) en fazla ~1.8 yarıçap içinde.
 * Sahne onu gezegenin boyutuyla ölçekler. Işık sahneden gelir (hemisphere + sol üstten directional).
 */
export interface CharacterState {
  dt: number; // saniye, en fazla ~0.05
  t: number; // toplam süre (saniye)
  hover: number; // 0..1, fare üzerindeyken yumuşakça 1'e çıkar
  night: number; // 0 gündüz, 1 gece (yumuşak geçiş)
  reduce: boolean; // hareket azaltma tercihi: sadece çok hafif hareket
  camera: THREE.Camera;
}

export interface Character {
  group: THREE.Group;
  update(s: CharacterState): void;
  /** Tıklanınca oynanan büyük, tek seferlik animasyon (~2-3 sn). */
  poke(): void;
}

/** Pastel kil paleti (sitenin renkleri). */
export const PAL = {
  coral: '#F2766B',
  butter: '#F7C548',
  pink: '#F28AC0',
  mint: '#4FC7B8',
  leaf: '#8FD694',
  periwinkle: '#7C8CF2',
  lilac: '#B79BF5',
  apricot: '#F9A65A',
  sky: '#6CC5EE',
  cream: '#FFF4E6',
  paper: '#FBF7EF',
  ink: '#3E1F38',
  cocoa: '#8A5A44',
  steel: '#C9CED8',
  white: '#FFFFFF',
} as const;

let bump: THREE.Texture | null = null;
/** Kil yüzeyi için hafif, parmak izi gibi pürüzlü bump dokusu. */
export function clayBump() {
  if (bump) return bump;
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const x = c.getContext('2d')!;
  x.fillStyle = '#808080';
  x.fillRect(0, 0, s, s);
  for (let i = 0; i < 900; i++) {
    const v = 110 + Math.random() * 40;
    x.fillStyle = `rgba(${v},${v},${v},0.35)`;
    x.beginPath();
    x.arc(Math.random() * s, Math.random() * s, 1 + Math.random() * 4, 0, Math.PI * 2);
    x.fill();
  }
  bump = new THREE.CanvasTexture(c);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  return bump;
}

const cache = new Map<string, THREE.Material>();
/** Mat, yumuşak kil malzemesi. Aynı ayarlar aynı malzemeyi paylaşır. */
export function clay(
  color: THREE.ColorRepresentation,
  o: { emissive?: number; rough?: number; side?: THREE.Side; transparent?: boolean; opacity?: number } = {},
) {
  const key = `clay|${new THREE.Color(color).getHexString()}|${o.emissive ?? ''}|${o.rough ?? ''}|${o.side ?? ''}|${o.opacity ?? ''}`;
  let m = cache.get(key) as THREE.MeshStandardMaterial | undefined;
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.82,
      metalness: 0,
      bumpMap: clayBump(),
      bumpScale: 0.6,
      emissive: color,
      emissiveIntensity: o.emissive ?? 0.08,
      side: o.side ?? THREE.FrontSide,
      transparent: o.transparent ?? o.opacity !== undefined,
      opacity: o.opacity ?? 1,
    });
    cache.set(key, m);
  }
  return m;
}

/** Işık saçan (aydınlatmadan etkilenmeyen) malzeme: neon, ekran, parıltı. Paylaşılmaz, opaklığı değiştirilebilir. */
export function glow(color: THREE.ColorRepresentation, opacity = 1, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

/** Köşeleri yuvarlatılmış kutu. */
export function rbox(w: number, h: number, d: number, r = 0.06, seg = 3) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
}

/** Noktalardan geçen yumuşak tüp. */
export function tube(points: THREE.Vector3[], r: number, seg = 64, rad = 10, closed = false) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), seg, r, rad, closed);
}

/** Canvas ile yazı/çizim dokusu. draw içinde 2d context ile istediğini çiz. */
export function canvasTexture(w: number, h: number, draw: (x: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Kısa yazı dokusu (etiket, harf, başlık). */
export function textTexture(
  text: string,
  o: { color?: string; bg?: string; font?: string; w?: number; h?: number } = {},
) {
  return canvasTexture(o.w ?? 256, o.h ?? 128, (x, w, h) => {
    if (o.bg) {
      x.fillStyle = o.bg;
      x.fillRect(0, 0, w, h);
    }
    x.fillStyle = o.color ?? PAL.ink;
    x.font = o.font ?? `bold ${Math.round(h * 0.55)}px system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + h * 0.03);
  });
}

/** Kare hızından bağımsız yumuşak yaklaşma. */
export const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt));
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const ease = {
  outBack: (x: number) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2),
  outElastic: (x: number) =>
    x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -9 * x) * Math.sin(((x * 10 - 0.75) * 2 * Math.PI) / 3) + 1,
  inOut: (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  out: (x: number) => 1 - Math.pow(1 - x, 3),
};

/** Tek seferlik animasyon zamanlayıcı: start() ile başlar, p 0→1 ilerler, bitince -1. */
export class OneShot {
  p = -1;
  constructor(public dur: number) {}
  start() {
    this.p = 0;
  }
  get on() {
    return this.p >= 0;
  }
  tick(dt: number) {
    if (this.p < 0) return -1;
    this.p += dt / this.dur;
    if (this.p >= 1) this.p = -1;
    return this.p;
  }
}
