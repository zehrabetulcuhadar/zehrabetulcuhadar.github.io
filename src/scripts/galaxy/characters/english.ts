import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, clay, clayBump, glow, PAL, rbox, smooth, ease, OneShot, type Character } from './kit';

/**
 * English: dev bir çay fincanı gezegen. Çayın içinde mısır gevreği gibi harfler yüzer,
 * buhar konuşma balonlarına dönüşür ("?", "Hi!", "a-b-c"), fincan kenarında minik bir İngiliz kasabası
 * (Big Ben, kırmızı telefon kulübesi, iki katlı otobüs) var, kaşık çayı karıştırır.
 * Dürtünce: kaşık hızla karıştırır, H-E-L-L-O harfleri yay şeklinde zıplar, sonra çaya geri sıçrar.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mat(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    V(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    V(sx, sy, sz),
  );
}

type Part = [THREE.BufferGeometry, THREE.ColorRepresentation, THREE.Matrix4?];
/** Farklı renkli parçaları tek, köşe renkli geometride birleştirir (tek çizim çağrısı). */
function merge(parts: Part[]) {
  const gs = parts.map(([g, c, m]) => {
    const x = g.index ? g.toNonIndexed() : g.clone();
    if (m) x.applyMatrix4(m);
    for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
    const col = new THREE.Color(c);
    const n = x.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = col.r;
      a[i * 3 + 1] = col.g;
      a[i * 3 + 2] = col.b;
    }
    x.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return x;
  });
  return mergeGeometries(gs)!;
}

function vcMat(rough = 0.8, emissive = 0.06) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: rough,
    metalness: 0,
    bumpMap: clayBump(),
    bumpScale: 0.5,
    emissive: '#ffffff',
    emissiveIntensity: emissive,
  });
}

/** a→b arası silindir (harf çizgileri, direkler). */
function seg(a: THREE.Vector3, b: THREE.Vector3, r: number, rad = 8) {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), rad, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.clone().normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(1, 1, 1)));
  return g;
}

// Harf çizgileri: birim yükseklikte çoklu çizgiler [x, y]
type Stroke = [number, number][];
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 10): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as [number, number];
  });
const GLYPHS: Record<string, { w: number; s: Stroke[] }> = {
  H: {
    w: 0.66,
    s: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0.66, 0],
        [0.66, 1],
      ],
      [
        [0, 0.5],
        [0.66, 0.5],
      ],
    ],
  },
  E: {
    w: 0.56,
    s: [
      [
        [0.56, 1],
        [0, 1],
        [0, 0],
        [0.56, 0],
      ],
      [
        [0, 0.52],
        [0.42, 0.52],
      ],
    ],
  },
  L: {
    w: 0.52,
    s: [
      [
        [0, 1],
        [0, 0],
        [0.52, 0],
      ],
    ],
  },
  O: { w: 0.76, s: [arc(0.38, 0.5, 0.38, 0.5, 0, Math.PI * 2, 18)] },
  A: {
    w: 0.72,
    s: [
      [
        [0, 0],
        [0.36, 1],
        [0.72, 0],
      ],
      [
        [0.16, 0.4],
        [0.56, 0.4],
      ],
    ],
  },
  B: {
    w: 0.6,
    s: [
      [[0, 0], [0, 1], [0.3, 1], ...arc(0.3, 0.76, 0.24, 0.24, Math.PI / 2, -Math.PI / 2, 8), [0, 0.52]],
      [[0, 0.52], [0.34, 0.52], ...arc(0.34, 0.26, 0.26, 0.26, Math.PI / 2, -Math.PI / 2, 8), [0, 0]],
    ],
  },
  C: { w: 0.7, s: [arc(0.42, 0.5, 0.42, 0.5, 0.75, Math.PI * 2 - 0.75, 14)] },
};
const LH = 0.21; // harf yüksekliği
function letterGeo(ch: string) {
  const g = GLYPHS[ch];
  const r = 0.03;
  const parts: THREE.BufferGeometry[] = [];
  const P = (p: [number, number]) => V((p[0] - g.w / 2) * LH, p[1] * LH, 0);
  for (const st of g.s) {
    if (st.length > 5) {
      // yaylar: düzgün tüp (O, C, B kıvrımları)
      const pts = st.map(P);
      const closed = pts[0].distanceTo(pts[pts.length - 1]) < 1e-3;
      if (closed) pts.pop();
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), pts.length * 2, r, 8, closed));
      if (!closed)
        for (const e of [pts[0], pts[pts.length - 1]])
          parts.push(new THREE.SphereGeometry(r, 8, 6).translate(e.x, e.y, e.z));
      continue;
    }
    for (let i = 0; i < st.length; i++) {
      const a = P(st[i]);
      // küre sadece uçlarda ve keskin köşelerde (yay içleri silindirle yeterince düzgün)
      let sharp = i === 0 || i === st.length - 1;
      if (!sharp) {
        const d0 = P(st[i])
          .sub(P(st[i - 1]))
          .normalize();
        const d1 = P(st[i + 1])
          .sub(P(st[i]))
          .normalize();
        sharp = d0.dot(d1) < 0.9;
      }
      if (sharp) parts.push(new THREE.SphereGeometry(r, 8, 6).translate(a.x, a.y, a.z));
      if (i > 0) parts.push(seg(P(st[i - 1]), a, r, 8));
    }
  }
  return mergeGeometries(
    parts
      .map((x) => (x.index ? x.toNonIndexed() : x))
      .map((x) => {
        x.deleteAttribute('uv');
        return x;
      }),
  )!;
}

// Fincan dış profili (r, y)
const OUTER: [number, number][] = [
  [0.0, -0.78],
  [0.44, -0.78],
  [0.48, -0.75],
  [0.47, -0.69],
  [0.52, -0.64],
  [0.68, -0.55],
  [0.84, -0.4],
  [0.95, -0.18],
  [1.0, 0.06],
  [1.02, 0.28],
  [1.035, 0.44],
];
const RIM_Y = 0.52;
const TEA_Y = 0.38;
function cupR(y: number) {
  for (let i = 1; i < OUTER.length; i++) {
    const [r1, y1] = OUTER[i];
    const [r0, y0] = OUTER[i - 1];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0 || 1);
  }
  return OUTER[OUTER.length - 1][0];
}
const onCup = (theta: number, y: number, off = 0) => {
  const r = cupR(y) + off;
  return V(Math.cos(theta) * r, y, Math.sin(theta) * r);
};

function bubbleTex(text: string, color: string) {
  return canvasTexture(256, 160, (x, w, h) => {
    x.fillStyle = color;
    x.font = `900 ${text.length > 3 ? 64 : 92}px "Trebuchet MS", system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 4);
  });
}

function teaTex() {
  return canvasTexture(256, 256, (x, w, h) => {
    const c = w / 2;
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#7A3E1E');
    g.addColorStop(0.35, '#B5602A');
    g.addColorStop(0.8, '#D98A3F');
    g.addColorStop(1, '#E9A85A');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.lineCap = 'round';
    for (let k = 0; k < 5; k++) {
      x.strokeStyle = k % 2 ? 'rgba(255,214,150,0.45)' : 'rgba(255,240,210,0.3)';
      x.lineWidth = 5 - k * 0.5;
      x.beginPath();
      for (let i = 0; i <= 80; i++) {
        const s = i / 80;
        const a = (k / 5) * Math.PI * 2 + s * Math.PI * 2.4;
        const r = 10 + s * c * 0.85;
        const px = c + Math.cos(a) * r;
        const py = c + Math.sin(a) * r;
        if (i === 0) x.moveTo(px, py);
        else x.lineTo(px, py);
      }
      x.stroke();
    }
  });
}

function softDot() {
  return canvasTexture(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

export default function create(): Character {
  const group = new THREE.Group();
  const cup = new THREE.Group();
  cup.rotation.x = 0.3; // içi görünsün diye kameraya doğru eğik
  cup.position.y = -0.08;
  group.add(cup);

  const HANDLE_A = -0.36; // kulp yönü (varsayılan görünüşte sağda, profilden)
  const parts: Part[] = [];

  // --- Fincan gövdesi (lathe) ---
  {
    const pts = OUTER.map(([r, y]) => new THREE.Vector2(r, y));
    pts.push(
      new THREE.Vector2(1.045, 0.49),
      new THREE.Vector2(1.02, 0.515),
      new THREE.Vector2(0.97, RIM_Y),
      new THREE.Vector2(0.86, RIM_Y),
      new THREE.Vector2(0.83, 0.5),
      new THREE.Vector2(0.815, 0.46),
      new THREE.Vector2(0.8, 0.2),
      new THREE.Vector2(0.0, 0.2),
    );
    parts.push([new THREE.LatheGeometry(pts, 60), PAL.sky]);
    // ağız kenarı şeridi ve ayak şeridi
    parts.push([new THREE.TorusGeometry(1.04, 0.028, 6, 64), PAL.butter, mat(0, 0.455, 0, Math.PI / 2)]);
    parts.push([new THREE.TorusGeometry(0.5, 0.025, 6, 40), PAL.coral, mat(0, -0.65, 0, Math.PI / 2)]);
    // yol (kenarın iç tarafında)
    parts.push([
      new THREE.RingGeometry(0.865, 0.905, 72).rotateX(-Math.PI / 2).translate(0, RIM_Y + 0.004, 0),
      '#B9AFC9',
    ]);
  }

  // --- Gövde süsleri: dalgalı sarı bant, mercan kıvrımlar, nane benekler ---
  {
    const band: THREE.Vector3[] = [];
    for (let i = 0; i < 120; i++) {
      const th = (i / 120) * Math.PI * 2;
      band.push(onCup(th, 0.04 + 0.075 * Math.sin(th * 6), 0.012));
    }
    parts.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(band, true), 150, 0.042, 6, true), PAL.butter]);
    for (let k = 0; k < 6; k++) {
      const th0 = (k / 6) * Math.PI * 2 + 0.26;
      const pts: THREE.Vector3[] = [];
      const dir = k % 2 ? 1 : -1;
      for (let i = 0; i <= 30; i++) {
        const s = i / 30;
        const ph = s * Math.PI * 3.2;
        const rad = 0.02 + 0.1 * s;
        const u = Math.cos(ph) * rad * dir;
        const v = Math.sin(ph) * rad;
        const y = -0.24 + v;
        pts.push(onCup(th0 + u / cupR(y), y, 0.012));
      }
      // kıvrımın kuyruğu banda doğru
      const yEnd = -0.24 + Math.sin(Math.PI * 3.2) * 0.12;
      pts.push(onCup(th0 + (dir * 0.16) / cupR(yEnd), -0.04, 0.012));
      parts.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 34, 0.028, 6), PAL.coral]);
    }
    for (let i = 0; i < 18; i++) {
      const th = (i / 18) * Math.PI * 2;
      const p = onCup(th, 0.31, 0.0);
      parts.push([
        new THREE.SphereGeometry(0.035, 7, 5),
        i % 2 ? PAL.mint : PAL.pink,
        new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -th, 0)), V(0.5, 1, 1)),
      ]);
    }
  }

  // --- Kulp: mavi kıvrım + üstüne sarılı sarı spiral ---
  {
    const hd = V(Math.cos(HANDLE_A), 0, Math.sin(HANDLE_A));
    const H = (s: number, y: number) => hd.clone().multiplyScalar(s).setY(y);
    const curve = new THREE.CatmullRomCurve3([
      H(0.96, 0.3),
      H(1.22, 0.33),
      H(1.42, 0.18),
      H(1.44, -0.04),
      H(1.3, -0.22),
      H(1.08, -0.3),
      H(0.88, -0.36),
    ]);
    parts.push([new THREE.TubeGeometry(curve, 48, 0.075, 10), PAL.sky]);
    const fr = curve.computeFrenetFrames(160, false);
    const hel: THREE.Vector3[] = [];
    for (let i = 0; i <= 160; i++) {
      const s = i / 160;
      const a = s * Math.PI * 14;
      hel.push(
        curve
          .getPointAt(s)
          .addScaledVector(fr.normals[i], Math.cos(a) * 0.07)
          .addScaledVector(fr.binormals[i], Math.sin(a) * 0.07),
      );
    }
    parts.push([new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hel), 220, 0.022, 5), PAL.butter]);
    // kulp uçlarında kıvrık bukleler
    const curl = (c: THREE.Vector3, up: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const s = i / 24;
        const a = s * Math.PI * 3;
        const r = 0.11 * (1 - s * 0.8);
        pts.push(
          c
            .clone()
            .addScaledVector(hd, Math.cos(a) * r)
            .setY(c.y + Math.sin(a) * r * up),
        );
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.03, 6);
    };
    parts.push([curl(H(1.36, 0.25), 1), PAL.coral]);
    parts.push([curl(H(1.24, -0.27), -1), PAL.coral]);
  }

  // --- Tabak (fincanın halkası) ---
  {
    const pts = [
      [0, -0.88],
      [0.5, -0.88],
      [0.56, -0.85],
      [1.05, -0.86],
      [1.3, -0.79],
      [1.45, -0.69],
      [1.47, -0.65],
      [1.42, -0.64],
      [1.3, -0.71],
      [1.05, -0.78],
      [0.6, -0.785],
      [0, -0.785],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    parts.push([new THREE.LatheGeometry(pts, 64), '#FAD9E6']);
    parts.push([new THREE.TorusGeometry(1.455, 0.026, 6, 72), PAL.coral, mat(0, -0.665, 0, Math.PI / 2)]);
    parts.push([new THREE.TorusGeometry(1.08, 0.016, 5, 64), PAL.periwinkle, mat(0, -0.77, 0, Math.PI / 2)]);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const r = 1.28;
      parts.push([
        new THREE.SphereGeometry(0.03, 6, 5),
        [PAL.white, PAL.butter, PAL.mint][i % 3],
        mat(Math.cos(a) * r, -0.735, Math.sin(a) * r, 0, 0, 0, 1, 0.45, 1),
      ]);
    }
    // tabakta iki şeker küpü ve bir kurabiye
    parts.push([rbox(0.13, 0.13, 0.13, 0.03), PAL.white, mat(0.78, -0.71, 0.78, 0, 0.5, 0)]);
    parts.push([rbox(0.12, 0.12, 0.12, 0.03), PAL.white, mat(0.93, -0.72, 0.58, 0.1, 1.1, 0)]);
    parts.push([new THREE.CylinderGeometry(0.13, 0.13, 0.04, 20), PAL.apricot, mat(-0.9, -0.75, 0.75, 0.08, 0, 0.05)]);
    for (let i = 0; i < 5; i++) {
      const a = i * 1.3;
      parts.push([
        new THREE.SphereGeometry(0.018, 6, 5),
        PAL.cocoa,
        mat(-0.9 + Math.cos(a) * 0.07, -0.725, 0.75 + Math.sin(a) * 0.07),
      ]);
    }
  }

  // --- Kenardaki kasaba ---
  const winPos: THREE.Matrix4[] = [];
  const lampPos: THREE.Vector3[] = [];
  {
    const r = rng(9);
    const houseCols = [PAL.coral, PAL.butter, PAL.pink, PAL.mint, PAL.lilac, PAL.apricot, PAL.cream];
    const roofCols = [PAL.cocoa, PAL.coral, PAL.periwinkle, '#C0504A'];
    const BIGBEN = 2.2; // açı (ön-sol)
    const PHONE = 2.0;
    const skip = (a: number) => Math.abs(((a - BIGBEN + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.32;
    const N = 30;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.05;
      if (skip(a)) continue;
      const rr = 0.955;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const rotY = -a + Math.PI / 2; // ön yüz dışarı bakar
      const kind = i % 3;
      if (kind === 2) {
        // ağaç
        const h = 0.05 + r() * 0.03;
        parts.push([new THREE.CylinderGeometry(0.008, 0.01, h, 6), PAL.cocoa, mat(x, RIM_Y + h / 2, z)]);
        if (r() < 0.5)
          parts.push([
            new THREE.SphereGeometry(0.04, 10, 8),
            PAL.leaf,
            mat(x, RIM_Y + h + 0.02, z, 0, 0, 0, 1, 1.15, 1),
          ]);
        else parts.push([new THREE.ConeGeometry(0.038, 0.1, 8), '#5FB07A', mat(x, RIM_Y + h + 0.03, z)]);
        continue;
      }
      const w = 0.065 + r() * 0.02;
      const h = 0.06 + r() * 0.05;
      const d = 0.06;
      const col = houseCols[Math.floor(r() * houseCols.length)];
      const m = new THREE.Matrix4().compose(
        V(x, RIM_Y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)),
        V(1, 1, 1),
      );
      const local = (lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
        m.clone().multiply(mat(lx, ly, lz, rx, ry, rz, sx, sy, sz));
      parts.push([rbox(w, h, d, 0.012, 1), col, local(0, h / 2, 0)]);
      // üçgen çatı (prizma)
      parts.push([
        new THREE.CylinderGeometry(w * 0.62, w * 0.62, d + 0.012, 3),
        roofCols[Math.floor(r() * roofCols.length)],
        local(0, h + w * 0.28, 0, Math.PI / 2, 0, Math.PI / 2, 1, 1, 1),
      ]);
      // kapı + pencere
      parts.push([new THREE.BoxGeometry(0.018, 0.03, 0.006), PAL.cocoa, local(-w * 0.2, 0.015, d / 2 + 0.002)]);
      parts.push([new THREE.BoxGeometry(0.018, 0.018, 0.006), '#CFEFFF', local(w * 0.22, h * 0.6, d / 2 + 0.002)]);
      winPos.push(local(w * 0.22, h * 0.6, d / 2 + 0.007, 0, 0, 0, 0.05, 0.05, 1));
      if (h > 0.085) {
        parts.push([new THREE.BoxGeometry(0.016, 0.016, 0.006), '#CFEFFF', local(-w * 0.2, h * 0.75, d / 2 + 0.002)]);
        winPos.push(local(-w * 0.2, h * 0.75, d / 2 + 0.007, 0, 0, 0, 0.045, 0.045, 1));
      }
      // baca
      if (r() < 0.4)
        parts.push([new THREE.BoxGeometry(0.014, 0.03, 0.014), PAL.cocoa, local(w * 0.25, h + w * 0.3, 0)]);
      // sokak lambası (her ikinci evde)
      if (i % 4 === 0) {
        const lx = Math.cos(a + 0.08) * 0.875;
        const lz = Math.sin(a + 0.08) * 0.875;
        parts.push([new THREE.CylinderGeometry(0.004, 0.005, 0.07, 5), PAL.ink, mat(lx, RIM_Y + 0.035, lz)]);
        parts.push([new THREE.SphereGeometry(0.011, 8, 6), '#FFE9A8', mat(lx, RIM_Y + 0.075, lz)]);
        lampPos.push(V(lx, RIM_Y + 0.075, lz));
      }
    }
    // Big Ben: saat kulesi
    {
      const a = BIGBEN;
      const m = new THREE.Matrix4().compose(
        V(Math.cos(a) * 0.95, RIM_Y, Math.sin(a) * 0.95),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0)),
        V(1, 1, 1),
      );
      const L = (lx: number, ly: number, lz: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
        m.clone().multiply(mat(lx, ly, lz, rx, ry, rz, sx, sy, sz));
      parts.push([rbox(0.085, 0.2, 0.085, 0.012, 1), '#E9C78A', L(0, 0.1, 0)]);
      for (let k = 0; k < 4; k++)
        parts.push([new THREE.BoxGeometry(0.088, 0.008, 0.088), '#C9A266', L(0, 0.04 + k * 0.04, 0)]);
      parts.push([rbox(0.1, 0.085, 0.1, 0.015, 1), PAL.butter, L(0, 0.245, 0)]);
      for (let k = 0; k < 4; k++) {
        const ry = (k * Math.PI) / 2;
        const cx = Math.sin(ry) * 0.052;
        const cz = Math.cos(ry) * 0.052;
        parts.push([
          new THREE.CylinderGeometry(0.032, 0.032, 0.008, 20),
          PAL.cream,
          L(cx, 0.245, cz, Math.PI / 2, 0, -ry, 1, 1, 1).multiply(mat(0, 0, 0, 0, 0, 0)),
        ]);
      }
      parts.push([new THREE.CylinderGeometry(0.003, 0.003, 0.022, 4), PAL.ink, L(0.0, 0.252, 0.058)]);
      parts.push([
        new THREE.CylinderGeometry(0.003, 0.003, 0.016, 4),
        PAL.ink,
        L(0.006, 0.245, 0.058, 0, 0, Math.PI / 2),
      ]);
      parts.push([new THREE.ConeGeometry(0.068, 0.13, 4), '#5E7FB8', L(0, 0.352, 0, 0, Math.PI / 4, 0)]);
      parts.push([new THREE.SphereGeometry(0.012, 8, 6), PAL.butter, L(0, 0.425, 0)]);
    }
    // kırmızı telefon kulübesi
    {
      const a = PHONE;
      const x = Math.cos(a) * 0.95;
      const z = Math.sin(a) * 0.95;
      const ry = -a + Math.PI / 2;
      const m = new THREE.Matrix4().compose(
        V(x, RIM_Y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)),
        V(1, 1, 1),
      );
      parts.push([rbox(0.045, 0.1, 0.045, 0.01, 1), '#E0473F', m.clone().multiply(mat(0, 0.05, 0))]);
      parts.push([rbox(0.05, 0.016, 0.05, 0.008, 1), '#C83A33', m.clone().multiply(mat(0, 0.104, 0))]);
      parts.push([new THREE.BoxGeometry(0.03, 0.05, 0.004), '#CFEFFF', m.clone().multiply(mat(0, 0.055, 0.023))]);
      winPos.push(m.clone().multiply(mat(0, 0.055, 0.027, 0, 0, 0, 0.034, 0.055, 1)));
    }
  }

  const staticMat = vcMat(0.78, 0.06);
  cup.add(new THREE.Mesh(merge(parts), staticMat));

  // pencere ışıkları (gece parlar)
  const quad = new THREE.PlaneGeometry(1, 1);
  const winMat = glow('#FFD77A', 0.0);
  winMat.map = softDot();
  const wins = new THREE.InstancedMesh(quad, winMat, winPos.length);
  winPos.forEach((m, i) => wins.setMatrixAt(i, m));
  cup.add(wins);
  const lampMat = glow('#FFE3A0', 0.3);
  lampMat.map = softDot();
  const lamps = new THREE.InstancedMesh(quad, lampMat, lampPos.length);
  lamps.frustumCulled = false;
  cup.add(lamps);

  // --- Çay yüzeyi: girdap çukurlu disk ---
  const teaGeo = new THREE.RingGeometry(0.001, 0.82, 56, 6);
  {
    const p = teaGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const r2 = x * x + y * y;
      p.setZ(i, -0.06 * Math.exp(-r2 / 0.06));
    }
    teaGeo.computeVertexNormals();
  }
  const teaMat = new THREE.MeshStandardMaterial({
    map: teaTex(),
    roughness: 0.28,
    metalness: 0,
    emissive: '#ffffff',
    emissiveMap: null,
    emissiveIntensity: 0.0,
  });
  const tea = new THREE.Mesh(teaGeo, teaMat);
  tea.rotation.x = -Math.PI / 2;
  tea.position.y = TEA_Y;
  cup.add(tea);

  // --- Harfler ---
  const LET = ['H', 'E', 'L', 'L', 'O', 'A', 'B', 'C'];
  const LCOL = [PAL.coral, PAL.butter, PAL.mint, PAL.periwinkle, PAL.pink, PAL.apricot, PAL.lilac, PAL.leaf];
  const geoCache: Record<string, THREE.BufferGeometry> = {};
  const letters = LET.map((ch, i) => {
    geoCache[ch] ??= letterGeo(ch);
    const holder = new THREE.Group();
    const m = new THREE.Mesh(geoCache[ch], clay(LCOL[i], { rough: 0.6, emissive: 0.12 }));
    holder.add(m);
    cup.add(holder);
    return {
      holder,
      mesh: m,
      a: (i / LET.length) * Math.PI * 2 * 1.37,
      r: [0.5, 0.62, 0.36, 0.58, 0.46, 0.66, 0.3, 0.55][i],
      ph: i * 1.7,
      j: 0,
      splashed: true,
    };
  });

  // --- Kaşık ---
  const spoonPivot = new THREE.Group();
  spoonPivot.position.y = TEA_Y;
  cup.add(spoonPivot);
  {
    const a = V(0.34, -0.04, 0);
    const b = V(1.0, 0.62, 0);
    const dir = b.clone().sub(a).normalize();
    const sp: Part[] = [];
    sp.push([seg(a.clone().addScaledVector(dir, 0.08), b, 0.026, 10), '#D7DCE6']);
    sp.push([new THREE.SphereGeometry(0.026, 10, 8), '#D7DCE6', mat(b.x, b.y, b.z)]);
    sp.push([new THREE.SphereGeometry(0.05, 14, 10), PAL.butter, mat(b.x + dir.x * 0.04, b.y + dir.y * 0.04, 0)]);
    sp.push([
      new THREE.TorusGeometry(0.03, 0.01, 6, 14),
      PAL.coral,
      mat(b.x - dir.x * 0.06, b.y - dir.y * 0.06, 0, 0, 0, Math.atan2(dir.y, dir.x) + Math.PI / 2),
    ]);
    // kaşık çanağı (çayın içinde)
    sp.push([
      new THREE.SphereGeometry(0.11, 16, 12),
      '#D7DCE6',
      mat(a.x - 0.02, a.y - 0.02, 0, 0, 0, Math.atan2(dir.y, dir.x) - 0.3, 1.25, 0.35, 0.8),
    ]);
    spoonPivot.add(new THREE.Mesh(merge(sp), vcMat(0.4, 0.08)));
  }

  // --- Buhar: kıvrık S şeridi + yükselen puflar ---
  const steamMat = clay('#FFF8F0', { opacity: 0.82, emissive: 0.25 });
  const steam = new THREE.Group();
  steam.position.y = TEA_Y - 0.03;
  cup.add(steam);
  const steamCurve = new THREE.CatmullRomCurve3([
    V(0.0, 0.0, 0),
    V(0.2, 0.18, 0),
    V(-0.16, 0.4, 0),
    V(0.15, 0.62, 0),
    V(-0.04, 0.8, 0),
    V(0.05, 0.9, 0),
  ]);
  {
    const TS = 80;
    const RS = 12;
    const g = new THREE.TubeGeometry(steamCurve, TS, 1, RS, false);
    const p = g.attributes.position;
    const c = V();
    const v = V();
    for (let i = 0; i <= TS; i++) {
      const s = i / TS;
      steamCurve.getPointAt(s, c);
      const rad = 0.095 * (1 - s * 0.6) * smooth(0, 0.08, s) + 0.01;
      for (let k = 0; k <= RS; k++) {
        const idx = i * (RS + 1) + k;
        v.fromBufferAttribute(p, idx).sub(c).multiplyScalar(rad).add(c);
        p.setXYZ(idx, v.x, v.y, v.z);
      }
    }
    g.computeVertexNormals();
    steam.add(new THREE.Mesh(g, steamMat));
  }
  const PUFF = 10;
  const puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), steamMat, PUFF);
  puffs.frustumCulled = false;
  cup.add(puffs);

  // --- Konuşma balonları ---
  const BUB = [
    { text: '?', color: PAL.periwinkle, x: -0.66, y: 1.22 },
    { text: 'Hi!', color: PAL.coral, x: 0.66, y: 1.32 },
    { text: 'a-b-c', color: '#2FA596', x: 0.02, y: 1.5 },
  ];
  const bubbleGeo = merge([
    [new THREE.SphereGeometry(1, 20, 12), PAL.white, mat(0, 0, 0, 0, 0, 0, 0.27, 0.19, 0.08)],
    [new THREE.ConeGeometry(0.06, 0.13, 10), PAL.white, mat(-0.1, -0.2, 0, 0, 0, -0.5, 1, 1, 0.5)],
  ]);
  const bubbleMat = vcMat(0.7, 0.14);
  const bubbles = BUB.map((b) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bubbleGeo, bubbleMat);
    const txt = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.26),
      new THREE.MeshBasicMaterial({ map: bubbleTex(b.text, b.color), transparent: true, depthWrite: false }),
    );
    txt.position.z = 0.085;
    g.add(body, txt);
    group.add(g);
    return { g, ...b };
  });

  // --- İki katlı kırmızı otobüs ---
  const bus = new THREE.Mesh(
    merge([
      [rbox(0.1, 0.068, 0.042, 0.014, 1), '#E0473F', mat(0, 0.046, 0)],
      [new THREE.BoxGeometry(0.102, 0.012, 0.044), PAL.cream, mat(0, 0.045, 0)],
      [new THREE.BoxGeometry(0.086, 0.014, 0.044), '#CFEFFF', mat(0, 0.064, 0)],
      [new THREE.BoxGeometry(0.086, 0.014, 0.044), '#CFEFFF', mat(0, 0.03, 0)],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.046, 10), PAL.ink, mat(0.03, 0.012, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.046, 10), PAL.ink, mat(-0.03, 0.012, 0, Math.PI / 2)],
    ]),
    vcMat(0.7, 0.08),
  );
  cup.add(bus);

  // --- Sıçrama damlaları ve halkalar ---
  const DROPS = 5 * 6;
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 6, 4),
    clay('#D98A3F', { rough: 0.3, emissive: 0.15 }),
    DROPS,
  );
  drops.frustumCulled = false;
  cup.add(drops);
  const ripples = new THREE.InstancedMesh(
    new THREE.TorusGeometry(1, 0.08, 6, 28).rotateX(Math.PI / 2),
    clay('#F6C48A', { rough: 0.3, emissive: 0.2 }),
    5,
  );
  ripples.frustumCulled = false;
  cup.add(ripples);
  const splashAt = Array.from({ length: 5 }, () => ({ p: V(), t: 9 }));

  // --- preallocated temps ---
  const tm = new THREE.Matrix4();
  const tq = new THREE.Quaternion();
  const camQ = new THREE.Quaternion();
  const tv = V();
  const tv2 = V();
  const ts = V();
  const camLocal = V();
  const right = V();
  const fwd = V();

  const shot = new OneShot(3.3);
  let spin = 0;
  let spinVel = 0.6;
  let teaRot = 0;
  let busA = 0.4;

  const update: Character['update'] = (s) => {
    const dt = s.dt;
    const t = s.t;
    const hv = s.hover;
    const rm = s.reduce ? 0.25 : 1;
    const p = shot.tick(dt);
    const T = p >= 0 ? p * shot.dur : -1;
    const on = T >= 0;

    // genel salınım
    group.position.y = Math.sin(t * 0.8) * 0.04 * rm;
    group.rotation.y = Math.sin(t * 0.2) * 0.2 * rm;
    cup.rotation.z = Math.sin(t * 0.5) * 0.03 * rm;

    // karıştırma hızı
    let target = (0.7 + hv * 1.6) * (s.reduce ? 0.3 : 1);
    if (on) target = 9 * smooth(0, 0.4, T) * (1 - smooth(1.2, 2.2, T)) + 1.2;
    spinVel += (target - spinVel) * Math.min(1, dt * 4);
    spin += spinVel * dt;
    spoonPivot.rotation.y = -spin;
    spoonPivot.rotation.z = Math.sin(spin * 2) * 0.04;
    teaRot += spinVel * 0.55 * dt;
    tea.rotation.z = teaRot;

    // kamera, fincan uzayında (harfler kameraya dönsün, HELLO soldan sağa okunsun)
    cup.updateMatrixWorld();
    s.camera.getWorldPosition(camLocal);
    cup.worldToLocal(camLocal);
    const yaw = Math.atan2(camLocal.x, camLocal.z);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    fwd.set(Math.sin(yaw), 0, Math.cos(yaw));

    // harfler
    for (let i = 0; i < letters.length; i++) {
      const L = letters[i];
      L.a -= spinVel * dt * (0.35 / (L.r + 0.25));
      // HELLO zıplaması
      let j = 0;
      let hop = 0;
      if (on && i < 5) {
        const up0 = 0.55 + i * 0.08;
        const dn0 = 2.15 + i * 0.07;
        const ju = smooth(up0, up0 + 0.45, T);
        const jd = smooth(dn0, dn0 + 0.4, T);
        j = ju * (1 - jd);
        hop = Math.sin(ju * Math.PI) * 0.35 * (1 - jd) + Math.sin(jd * Math.PI) * 0.25;
        if (jd > 0.97 && !L.splashed) {
          L.splashed = true;
          splashAt[i].t = 0;
        }
        if (ju > 0.1) L.splashed = false;
      }
      L.j = j;
      const bob = Math.sin(t * 1.8 + L.ph) * 0.02 * (1 + hv) * rm;
      tv.set(Math.cos(L.a) * L.r, TEA_Y - 0.025 + bob, Math.sin(L.a) * L.r);
      // yay pozisyonu: kameranın sağ yönü boyunca
      const k = i - 2;
      tv2.copy(right).multiplyScalar(k * 0.29);
      tv2.y = 1.12 - 0.05 * k * k + Math.sin(t * 6 + i) * 0.025;
      tv2.addScaledVector(fwd, 0.15);
      L.holder.position.copy(tv).lerp(tv2, ease.inOut(j));
      L.holder.position.y += hop;
      const wob = Math.sin(t * 1.3 + L.ph) * 0.2 * rm;
      L.holder.rotation.set(
        wob * (1 - j) - 0.3 * j + 0.15,
        yaw + Math.sin(t * 0.9 + L.ph) * 0.3 * (1 - j) * rm + j * Math.sin(T * 10) * 0.0,
        Math.sin(t * 1.1 + L.ph * 2) * 0.15 * (1 - j) * rm + (j > 0 && j < 1 ? Math.sin(j * Math.PI) * 0.6 : 0),
      );
      const sc = 1 + j * 0.45;
      L.holder.scale.setScalar(sc);
    }

    // sıçramalar
    let di = 0;
    for (let i = 0; i < 5; i++) {
      const sp = splashAt[i];
      if (sp.t < 1) {
        if (sp.t === 0) sp.p.set(Math.cos(letters[i].a) * letters[i].r, TEA_Y, Math.sin(letters[i].a) * letters[i].r);
        sp.t += dt * 1.6;
      }
      const u = sp.t;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + i;
        const live = u < 1 ? 1 : 0;
        const rr = u * 0.22;
        tv.set(sp.p.x + Math.cos(a) * rr, TEA_Y + Math.sin(Math.min(1, u) * Math.PI) * 0.18, sp.p.z + Math.sin(a) * rr);
        const sc = live * 0.022 * (1 - u * 0.6) + 1e-4;
        tm.compose(tv, tq.identity(), ts.set(sc, sc, sc));
        drops.setMatrixAt(di++, tm);
      }
      const rs = u < 1 ? 0.05 + u * 0.22 : 1e-4;
      tm.compose(tv.set(sp.p.x, TEA_Y + 0.005, sp.p.z), tq.identity(), ts.set(rs, rs * (1 - u) + 1e-4, rs));
      ripples.setMatrixAt(i, tm);
    }
    drops.instanceMatrix.needsUpdate = true;
    ripples.instanceMatrix.needsUpdate = true;

    // buhar
    const sv = 1 + hv * 0.5;
    steam.rotation.y = yaw + Math.sin(t * 0.7) * 0.4 * rm;
    steam.scale.set(
      1 + Math.sin(t * 1.7) * 0.08 * rm,
      (0.95 + Math.sin(t * 1.1) * 0.06 * rm) * (on ? 1 - 0.5 * smooth(0.3, 0.8, T) * (1 - smooth(2.4, 3.0, T)) : 1),
      1,
    );
    steam.rotation.z = Math.sin(t * 0.9) * 0.08 * rm;
    for (let i = 0; i < PUFF; i++) {
      const u = (t * 0.22 * sv * (s.reduce ? 0.3 : 1) + i / PUFF) % 1;
      const a = i * 2.4 + t * 0.3;
      tv.set(Math.cos(a) * 0.12 * u + Math.sin(u * 9 + i) * 0.04, TEA_Y + 0.15 + u * 0.75, Math.sin(a) * 0.12 * u);
      const sc = 0.05 * Math.sin(u * Math.PI) * (1 + u) + 1e-4;
      tm.compose(tv, tq.identity(), ts.set(sc, sc, sc));
      puffs.setMatrixAt(i, tm);
    }
    puffs.instanceMatrix.needsUpdate = true;

    // balonlar: buharın tepesinden çıkar, büyür, süzülür, patlar
    s.camera.getWorldQuaternion(camQ);
    group.getWorldQuaternion(tq).invert().multiply(camQ);
    const pokeHide = on ? smooth(0.3, 0.6, T) * (1 - smooth(2.6, 3.2, T)) : 0;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const cyc = 6;
      const u = ((t * (1 + hv * 0.4) + i * 2) % cyc) / cyc;
      const grow = ease.outBack(smooth(0.0, 0.18, u));
      const pop = smooth(0.86, 0.95, u);
      const sc = grow * (1 - pop) * (1 + pop * 0.6) * (1 - pokeHide) * (s.reduce ? 1 : 1) + 1e-4;
      const rise = smooth(0, 0.3, u);
      b.g.position.set(b.x * rise, 0.95 + (b.y - 0.95) * rise + Math.sin(t * 1.4 + i) * 0.03 + u * 0.08, 0.1);
      b.g.quaternion.copy(tq);
      b.g.rotateZ(Math.sin(t * 1.2 + i * 2) * 0.08 * rm);
      b.g.scale.setScalar(sc);
    }

    // otobüs
    busA += dt * (0.18 + hv * 0.3) * (s.reduce ? 0.3 : 1);
    const br = 0.885;
    bus.position.set(Math.cos(busA) * br, RIM_Y + 0.004 + Math.abs(Math.sin(t * 14)) * 0.004 * rm, Math.sin(busA) * br);
    bus.rotation.set(0, -busA - Math.PI, 0);

    // gece ışıkları
    winMat.opacity = 0.1 + s.night * 0.85;
    lampMat.opacity = 0.15 + s.night * 0.75;
    cup.getWorldQuaternion(tq).invert().multiply(camQ);
    for (let i = 0; i < lampPos.length; i++) {
      const sc = 0.05 + s.night * 0.04 + Math.sin(t * 3 + i) * 0.005;
      tm.compose(lampPos[i], tq, ts.set(sc, sc, sc));
      lamps.setMatrixAt(i, tm);
    }
    lamps.instanceMatrix.needsUpdate = true;
    teaMat.emissiveIntensity = s.night * 0.08;
    staticMat.emissiveIntensity = 0.06 + s.night * 0.04;
  };

  return {
    group,
    update,
    poke() {
      if (shot.on && (shot.p ?? 0) < 0.85) return;
      shot.start();
    },
  };
}
