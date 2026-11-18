import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, clay, clayBump, glow, PAL, rbox, smooth, ease, OneShot, type Character } from './kit';

/**
 * AI: galaksi renkli, kıvrımları tüplerden yapılmış bir beyin gezegeni.
 * Tepesinde bacaklarını sallayan meraklı küçük bir robot oturuyor.
 * Dürtünce: robotun kafası açılır, kendi minik beynini çıkarır, gezegene takar,
 * gezegenden galaksi renkli bir parça alıp kafasına koyar, gözleri yanar.
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

function softDot() {
  return canvasTexture(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

function sparkleTex() {
  return canvasTexture(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.5)');
    g.addColorStop(0.4, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    x.beginPath();
    const c = w / 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? c * 0.95 : c * 0.12;
      x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    x.fill();
  });
}

function galaxyTex() {
  return canvasTexture(128, 128, (x, w) => {
    const c = w / 2;
    const g = x.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,240,220,1)');
    g.addColorStop(0.18, 'rgba(255,170,220,0.6)');
    g.addColorStop(0.6, 'rgba(140,120,255,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
    const r = rng(7);
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 260; i++) {
        const k = i / 260;
        const a = arm * Math.PI + k * Math.PI * 2.6;
        const rad = 4 + k * c * 0.85;
        const px = c + Math.cos(a) * rad + (r() - 0.5) * 8 * (0.4 + k);
        const py = c + Math.sin(a) * rad + (r() - 0.5) * 8 * (0.4 + k);
        x.fillStyle = r() < 0.5 ? 'rgba(170,200,255,0.55)' : 'rgba(255,170,230,0.55)';
        x.beginPath();
        x.arc(px, py, 1 + r() * 1.8 * (1 - k), 0, Math.PI * 2);
        x.fill();
      }
    }
  });
}

function spaceTex() {
  return canvasTexture(512, 256, (x, w, h) => {
    x.fillStyle = '#3b2f7a';
    x.fillRect(0, 0, w, h);
    const r = rng(3);
    const cols = ['#6a4fd0', '#c04f9e', '#3f7fd0', '#8a5ad8', '#d0709a'];
    for (let i = 0; i < 40; i++) {
      const px = r() * w;
      const py = r() * h;
      const rad = 20 + r() * 60;
      const g = x.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, cols[i % cols.length] + 'aa');
      g.addColorStop(1, cols[i % cols.length] + '00');
      x.fillStyle = g;
      x.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 420; i++) {
      x.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.6})`;
      x.fillRect(r() * w, r() * h, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
    }
  });
}

// Beyin yüzeyi: uzun ekseni x (önü +x), yarım küreler z=0 ile ayrılır.
const SX = 1.12;
const SY = 0.9;
const SZ = 0.95;
function surf(d: THREE.Vector3, out: THREE.Vector3) {
  const top = smooth(-0.15, 0.45, d.y);
  const k = 1 - 0.1 * Math.exp(-(d.z * d.z) / 0.004) * top - 0.05 * Math.exp(-(d.z * d.z) / 0.02) * top;
  const xs = d.x > 0 ? SX : SX * 0.95;
  const ys = d.y < 0 ? SY * 0.86 : SY;
  // şakak lobu: ön-alt yanlarda hafif şişlik
  const temporal = 1 + 0.05 * Math.exp(-((d.x - 0.35) ** 2 + (d.y + 0.35) ** 2) / 0.08) * Math.abs(d.z);
  return out.set(d.x * xs * k * temporal, d.y * ys * k, d.z * SZ * k * temporal);
}

const NEB = [PAL.periwinkle, PAL.lilac, PAL.pink, '#FFB3D9', PAL.butter, PAL.sky, PAL.periwinkle].map(
  (c) => new THREE.Color(c),
);
function nebula(p: THREE.Vector3, out: THREE.Color) {
  const n =
    0.5 +
    0.28 * Math.sin(p.x * 2.3 + Math.sin(p.y * 3.1 + p.z) * 1.3) +
    0.22 * Math.sin(p.z * 2.7 - p.y * 1.9 + Math.cos(p.x * 2.2) * 1.1);
  const f = Math.min(0.999, Math.max(0, n)) * (NEB.length - 1);
  const i = Math.floor(f);
  return out.copy(NEB[i]).lerp(NEB[i + 1], f - i);
}

type Worm = THREE.Vector3[];

function buildWorms(): Worm[] {
  const r = rng(11);
  const occ: { p: THREE.Vector3; w: number; i: number }[] = [];
  const worms: Worm[] = [];
  const D = 0.182;
  const STEP = 0.05;
  const free = (p: THREE.Vector3, w: number, i: number) => {
    if (Math.abs(p.z) < 0.1 && p.y > -0.35) return false; // orta yarık
    if (p.x < -0.55 && p.y < -0.25) return false; // beyincik
    for (const o of occ) {
      if (o.w === w && i - o.i < 7) continue;
      if (o.p.distanceToSquared(p) < D * D) return false;
    }
    return true;
  };
  const tmp = V();
  // Fibonacci küresi üzerinde karışık sırada başlangıç noktaları: yüzeyi eşit doldurur
  const N = 2400;
  const starts: THREE.Vector3[] = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const rr = Math.sqrt(1 - y * y);
    const a = i * 2.399963;
    starts.push(V(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [starts[i], starts[j]] = [starts[j], starts[i]];
  }
  for (let pass = 0; pass < 2; pass++)
    for (const d of starts) {
      const w = worms.length;
      if (!free(d, w, 0)) continue;
      let h = V(r() - 0.5, r() - 0.5, r() - 0.5);
      h.addScaledVector(d, -h.dot(d)).normalize();
      const pts: THREE.Vector3[] = [d.clone()];
      const local: { p: THREE.Vector3; w: number; i: number }[] = [{ p: d.clone(), w, i: 0 }];
      occ.push(local[0]);
      let turn = 0;
      let cur = d.clone();
      for (let i = 1; i < 34; i++) {
        turn = turn * 0.75 + (r() - 0.5) * 1.3;
        let ok = false;
        for (const extra of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
          const hh = h.clone().applyAxisAngle(cur, turn + extra);
          tmp.copy(cur).addScaledVector(hh, STEP).normalize();
          if (free(tmp, w, i)) {
            h = hh;
            ok = true;
            break;
          }
        }
        if (!ok) break;
        cur = tmp.clone();
        h.addScaledVector(cur, -h.dot(cur)).normalize();
        pts.push(cur);
        const o = { p: cur, w, i };
        occ.push(o);
        local.push(o);
      }
      if (pts.length < (pass === 0 ? 6 : 3)) {
        for (const o of local) occ.splice(occ.indexOf(o), 1);
        continue;
      }
      worms.push(pts);
    }
  return worms;
}

function miniBrainGeo() {
  const g = new THREE.SphereGeometry(1, 22, 16);
  const p = g.attributes.position;
  const v = V();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n =
      1 +
      0.09 * Math.sin(v.x * 9 + v.y * 4) * Math.sin(v.y * 8 - v.z * 5) -
      0.12 * Math.exp(-(v.z * v.z) / 0.01) * Math.max(0, v.y);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x * 1.18, v.y * 0.85, v.z);
  }
  g.computeVertexNormals();
  g.scale(0.085, 0.085, 0.085);
  return g;
}

export default function create(): Character {
  const group = new THREE.Group();
  const planet = new THREE.Group();
  group.add(planet);

  // --- Beyin tabanı (oluklar): galaksi dokulu ---
  const space = spaceTex();
  const baseGeo = new THREE.SphereGeometry(1, 60, 40);
  {
    const p = baseGeo.attributes.position;
    const d = V();
    const o = V();
    for (let i = 0; i < p.count; i++) {
      d.fromBufferAttribute(p, i).normalize();
      surf(d, o).multiplyScalar(0.965);
      p.setXYZ(i, o.x, o.y, o.z);
    }
    baseGeo.computeVertexNormals();
  }
  const baseMat = new THREE.MeshStandardMaterial({
    map: space,
    emissiveMap: space,
    emissive: '#ffffff',
    emissiveIntensity: 0.35,
    roughness: 0.7,
    bumpMap: clayBump(),
    bumpScale: 0.4,
  });
  planet.add(new THREE.Mesh(baseGeo, baseMat));

  // --- Kıvrımlar (gyri): tüpler, nebula renkleri ---
  const worms = buildWorms();
  const TR = 0.09;
  const wormGeos: THREE.BufferGeometry[] = [];
  const wormPaths: THREE.Vector3[][] = []; // nöron ışıkları için tüp üstü yolları
  {
    const c = new THREE.Color();
    const o = V();
    for (const w of worms) {
      const pts = w.map((d) => surf(d, V()).multiplyScalar(1 - 0.018));
      const curve = new THREE.CatmullRomCurve3(pts);
      const g = new THREE.TubeGeometry(curve, Math.max(4, Math.round(pts.length * 0.95)), TR, 6, false);
      const caps = [pts[0], pts[pts.length - 1]].map((q) =>
        new THREE.SphereGeometry(TR, 8, 6).translate(q.x, q.y, q.z),
      );
      const parts = [g, ...caps].map((x0) => {
        const x = x0.index ? x0.toNonIndexed() : x0;
        x.deleteAttribute('uv');
        const n = x.attributes.position.count;
        const a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          o.fromBufferAttribute(x.attributes.position, i);
          nebula(o, c);
          a[i * 3] = c.r;
          a[i * 3 + 1] = c.g;
          a[i * 3 + 2] = c.b;
        }
        x.setAttribute('color', new THREE.BufferAttribute(a, 3));
        return x;
      });
      wormGeos.push(...parts);
      wormPaths.push(w.map((d) => surf(d, V()).multiplyScalar(1 + 0.065)));
    }
  }
  const wormMat = vcMat(0.55, 0.05);
  planet.add(new THREE.Mesh(mergeGeometries(wormGeos)!, wormMat));

  // --- Beyincik + beyin sapı (tanınırlık için) ---
  {
    const parts: Part[] = [];
    const cb = new THREE.SphereGeometry(1, 32, 24);
    {
      const q = cb.attributes.position;
      const v = V();
      for (let i = 0; i < q.count; i++) {
        v.fromBufferAttribute(q, i);
        const k = 1 + 0.07 * Math.abs(Math.sin(v.y * 7.5)) - 0.04;
        q.setXYZ(i, v.x * k, v.y, v.z * k * (1 - 0.12 * Math.exp(-(v.z * v.z) / 0.02)));
      }
      cb.computeVertexNormals();
    }
    parts.push([cb, '#9C86E8', mat(-0.7, -0.42, 0, 0, 0, 0.35, 0.36, 0.27, 0.66)]);
    const stem = new THREE.CylinderGeometry(0.13, 0.085, 0.36, 14);
    parts.push([stem, '#C79BE8', mat(-0.36, -0.8, 0, 0, 0, 0.42)]);
    planet.add(new THREE.Mesh(merge(parts), vcMat(0.7, 0.05)));
  }

  // --- Parıltılar (kıvrımların üstünde yanıp sönen yıldızlar) ---
  const camQ = new THREE.Quaternion();
  const tq = new THREE.Quaternion();
  const tq2 = new THREE.Quaternion();
  const tv = V();
  const tv2 = V();
  const ts = V();
  const tm = new THREE.Matrix4();
  const quad = new THREE.PlaneGeometry(1, 1);

  const SPARK = 46;
  const sparkPos: THREE.Vector3[] = [];
  {
    const r = rng(5);
    for (let i = 0; i < SPARK; i++) {
      const w = wormPaths[Math.floor(r() * wormPaths.length)];
      sparkPos.push(w[Math.floor(r() * w.length)].clone().multiplyScalar(1.01));
    }
  }
  const sparkMat = glow('#ffffff', 0.95);
  sparkMat.map = sparkleTex();
  const sparks = new THREE.InstancedMesh(quad, sparkMat, SPARK);
  sparks.frustumCulled = false;
  planet.add(sparks);

  // --- Nöron ateşlemeleri: kıvrımlar boyunca akan ışık boncukları ---
  const NP = 18;
  const TRAIL = 4;
  const dotMat = glow('#ffffff', 1);
  dotMat.map = softDot();
  const pulses = new THREE.InstancedMesh(quad, dotMat, NP * (TRAIL + 1));
  pulses.frustumCulled = false;
  planet.add(pulses);
  const pulseCols = [PAL.sky, '#FFE38A', PAL.pink, '#B8F3FF', '#E3C8FF'].map((c) => new THREE.Color(c));
  const longPaths = wormPaths.filter((q) => q.length > 14);
  const pr = rng(21);
  const P = Array.from({ length: NP }, (_, i) => ({
    path: longPaths[i % longPaths.length],
    u: pr(),
    speed: 0.35 + pr() * 0.3,
    delay: pr() * 2,
    flash: 0,
    dir: pr() < 0.5 ? 1 : -1,
  }));
  for (let i = 0; i < NP; i++) {
    const col = pulseCols[i % pulseCols.length];
    for (let k = 0; k <= TRAIL; k++) pulses.setColorAt(i * (TRAIL + 1) + k, col);
  }
  const pathPoint = (path: THREE.Vector3[], u: number, out: THREE.Vector3) => {
    const f = Math.min(0.9999, Math.max(0, u)) * (path.length - 1);
    const i = Math.floor(f);
    return out.copy(path[i]).lerp(path[i + 1], f - i);
  };

  // --- Yörüngede iki minik sarmal galaksi ---
  const galMat = glow('#ffffff', 0.9);
  galMat.map = galaxyTex();
  const gals = new THREE.InstancedMesh(quad, galMat, 2);
  gals.frustumCulled = false;
  group.add(gals);

  // =================== ROBOT ===================
  const vc = vcMat(0.75, 0.07);
  const seatDir = V(0.06, 0.88, 0.47).normalize();
  const seat = surf(seatDir, V());
  const seatN = V(seat.x / (SX * SX), seat.y / (SY * SY), seat.z / (SZ * SZ)).normalize();
  const robot = new THREE.Group();
  robot.position.copy(seat).addScaledVector(seatN, TR * 0.9);
  robot.quaternion.setFromUnitVectors(V(0, 1, 0), V(0, 1, 0).lerp(seatN, 0.45).normalize());
  robot.scale.setScalar(1.12);
  planet.add(robot);

  const torso = new THREE.Group();
  robot.add(torso);
  torso.add(
    new THREE.Mesh(
      merge([
        [rbox(0.24, 0.2, 0.18, 0.07), PAL.sky, mat(0, 0.13, 0)],
        [rbox(0.2, 0.05, 0.16, 0.025), '#5AAFD8', mat(0, 0.03, 0)],
        [rbox(0.15, 0.11, 0.03, 0.02), PAL.butter, mat(0, 0.13, 0.088)],
        [new THREE.CylinderGeometry(0.034, 0.034, 0.02, 20), PAL.apricot, mat(0, 0.135, 0.105, Math.PI / 2)],
        [new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), PAL.coral, mat(-0.052, 0.168, 0.105, Math.PI / 2)],
        [new THREE.CylinderGeometry(0.008, 0.008, 0.012, 8), PAL.mint, mat(0.052, 0.168, 0.105, Math.PI / 2)],
        [new THREE.CylinderGeometry(0.045, 0.05, 0.05, 16), PAL.steel, mat(0, 0.25, 0)],
        [new THREE.SphereGeometry(0.04, 12, 10), PAL.apricot, mat(0.135, 0.18, 0)],
        [new THREE.SphereGeometry(0.04, 12, 10), PAL.apricot, mat(-0.135, 0.18, 0)],
      ]),
      vc,
    ),
  );
  const chestGlowMat = glow(PAL.butter, 0.9);
  const chestGlow = new THREE.Mesh(new THREE.CircleGeometry(0.022, 20), chestGlowMat);
  chestGlow.position.set(0, 0.135, 0.116);
  torso.add(chestGlow);

  // Kafa
  const head = new THREE.Group();
  head.position.set(0, 0.27, 0);
  torso.add(head);
  head.add(
    new THREE.Mesh(
      merge([
        [rbox(0.32, 0.2, 0.26, 0.07), PAL.sky, mat(0, 0.1, 0)],
        [rbox(0.26, 0.15, 0.03, 0.05), PAL.butter, mat(0, 0.1, 0.125)],
        [new THREE.TorusGeometry(0.022, 0.006, 6, 14, Math.PI), PAL.ink, mat(0, 0.062, 0.142, 0, 0, Math.PI)],
        [new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20), PAL.apricot, mat(0.165, 0.1, 0, 0, 0, Math.PI / 2)],
        [new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20), PAL.apricot, mat(-0.165, 0.1, 0, 0, 0, Math.PI / 2)],
        [new THREE.CylinderGeometry(0.028, 0.028, 0.05, 14), PAL.steel, mat(0.17, 0.1, 0, 0, 0, Math.PI / 2)],
        [new THREE.CylinderGeometry(0.028, 0.028, 0.05, 14), PAL.steel, mat(-0.17, 0.1, 0, 0, 0, Math.PI / 2)],
        // kafatası yuvası (kapak açılınca görünür)
        [new THREE.CylinderGeometry(0.095, 0.095, 0.012, 24), '#2B2350', mat(0, 0.198, 0)],
        [new THREE.TorusGeometry(0.098, 0.01, 6, 24), PAL.steel, mat(0, 0.203, 0, Math.PI / 2)],
      ]),
      vc,
    ),
  );
  // Gözler (kırpmak için ayrı)
  const eyes = new THREE.Mesh(
    merge([
      [new THREE.SphereGeometry(0.042, 16, 12), '#ffffff', mat(-0.058, 0, 0, 0, 0, 0, 1, 1, 0.45)],
      [new THREE.SphereGeometry(0.042, 16, 12), '#ffffff', mat(0.058, 0, 0, 0, 0, 0, 1, 1, 0.45)],
      [new THREE.SphereGeometry(0.026, 14, 10), PAL.ink, mat(-0.058, 0, 0.014, 0, 0, 0, 1, 1, 0.5)],
      [new THREE.SphereGeometry(0.026, 14, 10), PAL.ink, mat(0.058, 0, 0.014, 0, 0, 0, 1, 1, 0.5)],
      [new THREE.SphereGeometry(0.008, 8, 6), '#ffffff', mat(-0.05, 0.01, 0.027)],
      [new THREE.SphereGeometry(0.008, 8, 6), '#ffffff', mat(0.066, 0.01, 0.027)],
    ]),
    vc,
  );
  eyes.position.set(0, 0.112, 0.135);
  head.add(eyes);
  const eyeGlowMat = glow(PAL.sky, 0);
  const eyeGlow = new THREE.Mesh(
    mergeGeometries([
      new THREE.CircleGeometry(0.05, 20).translate(-0.058, 0, 0.03),
      new THREE.CircleGeometry(0.05, 20).translate(0.058, 0, 0.03),
    ])!,
    eyeGlowMat,
  );
  eyes.add(eyeGlow);

  // Kafa kapağı: arkadan menteşeli
  const lid = new THREE.Group();
  lid.position.set(0, 0.2, -0.13);
  head.add(lid);
  lid.add(
    new THREE.Mesh(
      merge([
        [rbox(0.32, 0.09, 0.26, 0.04), PAL.sky, mat(0, 0.04, 0.13)],
        [rbox(0.33, 0.025, 0.27, 0.012), '#5AAFD8', mat(0, 0.008, 0.13)],
        [new THREE.CylinderGeometry(0.04, 0.05, 0.03, 16), PAL.apricot, mat(0, 0.09, 0.13)],
        [new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), PAL.steel, mat(0.09, 0.13, 0.13, 0, 0, -0.25)],
        [new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), PAL.steel, mat(-0.09, 0.13, 0.13, 0, 0, 0.25)],
        [new THREE.SphereGeometry(0.024, 12, 10), PAL.coral, mat(0.106, 0.19, 0.13)],
        [new THREE.SphereGeometry(0.024, 12, 10), PAL.coral, mat(-0.106, 0.19, 0.13)],
        [new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), PAL.steel, mat(0, 0.0, 0.0, 0, 0, Math.PI / 2)],
      ]),
      vc,
    ),
  );
  const antMat = glow('#FFC9B8', 0.6);
  antMat.map = softDot();
  const antGlow = new THREE.InstancedMesh(quad, antMat, 2);
  antGlow.frustumCulled = false;
  lid.add(antGlow);
  const antTips = [V(0.106, 0.19, 0.13), V(-0.106, 0.19, 0.13)];

  // Kollar: omuz → dirsek (iki kemik IK)
  const L1 = 0.13;
  const L2 = 0.19; // dirsek → tutma noktası
  type Arm = { root: THREE.Group; elbow: THREE.Group; grip: THREE.Object3D; S: THREE.Vector3; side: number };
  const makeArm = (side: number): Arm => {
    const root = new THREE.Group();
    const S = V(0.15 * side, 0.18, 0);
    root.position.copy(S);
    torso.add(root);
    root.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.03, L1 - 0.03, 4, 10).translate(0, -L1 / 2, 0), clay(PAL.sky)));
    const elbow = new THREE.Group();
    elbow.position.set(0, -L1, 0);
    root.add(elbow);
    elbow.add(
      new THREE.Mesh(
        merge([
          [new THREE.SphereGeometry(0.034, 12, 10), PAL.apricot],
          [new THREE.CapsuleGeometry(0.027, 0.09, 4, 10), PAL.sky, mat(0, -0.07, 0)],
          [new THREE.SphereGeometry(0.042, 14, 10), PAL.apricot, mat(0, -0.145, 0)],
          [
            new THREE.CapsuleGeometry(0.012, 0.03, 3, 6),
            PAL.apricot,
            mat(0.03 * side, -0.165, 0.02, 0.3, 0, 0.6 * side),
          ],
        ]),
        vc,
      ),
    );
    const grip = new THREE.Object3D();
    grip.position.set(0, -L2, 0);
    elbow.add(grip);
    return { root, elbow, grip, S, side };
  };
  const armR = makeArm(1);
  const armL = makeArm(-1);

  // Bacaklar: diz menteşesi
  const makeLeg = (side: number) => {
    const hip = new THREE.Group();
    hip.position.set(0.065 * side, 0.02, 0.03);
    torso.add(hip);
    hip.add(
      new THREE.Mesh(
        new THREE.CapsuleGeometry(0.036, 0.08, 4, 10).rotateX(Math.PI / 2).translate(0, 0, 0.05),
        clay(PAL.sky),
      ),
    );
    const knee = new THREE.Group();
    knee.position.set(0, 0, 0.12);
    hip.add(knee);
    knee.add(
      new THREE.Mesh(
        merge([
          [new THREE.SphereGeometry(0.038, 12, 10), PAL.apricot],
          [new THREE.CapsuleGeometry(0.032, 0.07, 4, 10), PAL.sky, mat(0, -0.06, 0)],
          [rbox(0.09, 0.055, 0.12, 0.025), PAL.butter, mat(0, -0.13, 0.02)],
          [new THREE.CylinderGeometry(0.024, 0.024, 0.01, 14), PAL.coral, mat(0, -0.155, 0.04)],
          [new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10), PAL.coral, mat(0.022, -0.155, -0.015)],
          [new THREE.CylinderGeometry(0.012, 0.012, 0.01, 10), PAL.coral, mat(-0.022, -0.155, -0.015)],
        ]),
        vc,
      ),
    );
    return knee;
  };
  const kneeR = makeLeg(1);
  const kneeL = makeLeg(-1);

  // Minik beyinler: robotunki (pembe) ve gezegen parçası (galaksi)
  const mbGeo = miniBrainGeo();
  const brainA = new THREE.Mesh(mbGeo, clay(PAL.pink, { emissive: 0.35 }));
  const galBrainMat = new THREE.MeshStandardMaterial({
    map: space,
    emissiveMap: space,
    emissive: '#ffffff',
    emissiveIntensity: 1.5,
    roughness: 0.5,
  });
  const brainB = new THREE.Mesh(mbGeo, galBrainMat);
  // taşınırken parlayan hale (Sprite kendiliğinden kameraya döner)
  const haloMat = new THREE.SpriteMaterial({
    map: softDot(),
    color: '#FFD6F0',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const haloA = new THREE.Sprite(haloMat);
  const haloB = new THREE.Sprite(haloMat);
  haloA.scale.setScalar(0.32);
  haloB.scale.setScalar(0.32);
  brainA.add(haloA);
  brainB.add(haloB);
  const headSlot = new THREE.Object3D();
  headSlot.position.set(0, 0.207, 0);
  head.add(headSlot);
  headSlot.add(brainA);

  // Gezegendeki yuva: robotun sağ önünde, yüzeyde
  const socket = new THREE.Object3D();
  {
    robot.updateMatrix();
    const local = V(0.25, -0.02, 0.16);
    const pp = local.clone().applyMatrix4(robot.matrix);
    const sp = surf(pp.clone().normalize(), V());
    const n = V(sp.x / (SX * SX), sp.y / (SY * SY), sp.z / (SZ * SZ)).normalize();
    sp.addScaledVector(n, TR * 0.6);
    const inv = robot.matrix.clone().invert();
    socket.position.copy(sp.applyMatrix4(inv));
    const nl = n.clone().transformDirection(inv);
    socket.quaternion.setFromUnitVectors(V(0, 1, 0), nl);
  }
  robot.add(socket);
  socket.add(brainB);
  brainB.visible = false;
  const socketGlowMat = glow('#E3C8FF', 0);
  socketGlowMat.map = softDot();
  const socketGlow = new THREE.Mesh(quad, socketGlowMat);
  socketGlow.rotation.x = -Math.PI / 2;
  socketGlow.scale.setScalar(0.35);
  socketGlow.position.y = 0.03;
  socket.add(socketGlow);

  let inHead: THREE.Mesh = brainA;
  let inPlanet: THREE.Mesh = brainB;

  // IK yardımcıları (önceden ayrılmış)
  const yAxisNeg = V(0, -1, 0);
  const ikDir = V();
  const ikUp = V();
  const ikE = V();
  const ikAxis = V();
  const qa = new THREE.Quaternion();
  const qf = new THREE.Quaternion();
  const solve = (arm: Arm, T: THREE.Vector3) => {
    ikDir.copy(T).sub(arm.S);
    const d = Math.min(L1 + L2 - 0.002, Math.max(0.06, ikDir.length()));
    ikDir.normalize();
    const a = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
    // dirsek dışarı ve geriye doğru bükülsün
    ikAxis.set(arm.side, -0.2, -0.6).normalize();
    ikAxis.crossVectors(ikDir, ikAxis).normalize();
    ikUp.copy(ikDir).applyAxisAngle(ikAxis, a);
    ikE.copy(arm.S).addScaledVector(ikUp, L1);
    qa.setFromUnitVectors(yAxisNeg, ikUp);
    arm.root.quaternion.copy(qa);
    ikDir.copy(T).sub(ikE).normalize();
    qf.setFromUnitVectors(yAxisNeg, ikDir);
    arm.elbow.quaternion.copy(qa).invert().multiply(qf);
  };

  const restR = V(0.2, -0.05, 0.07);
  const restL = V(-0.2, -0.05, 0.07);
  const showP = V(0.3, 0.42, 0.2);
  const sockT = V();
  const headT = V();
  const tgtR = V();
  const tgtL = V();
  const waveT = V();

  const lerpTo = (out: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, k: number) => out.copy(a).lerp(b, k);

  // --- durum ---
  const shot = new OneShot(3.5);
  let lidA = 0;
  let flash = 0;
  let blinkT = 2.2;
  let blink = 0;
  let lookY = 0;
  let lookX = 0;
  let pulseBoost = 0;
  let wasOn = false;

  const place = (m: THREE.Mesh, parent: THREE.Object3D, y = 0) => {
    if (m.parent !== parent) parent.add(m);
    m.position.set(0, y, 0);
  };

  const update: Character['update'] = (s) => {
    const dt = s.dt;
    const t = s.t;
    const rm = s.reduce ? 0.25 : 1;
    const hv = s.hover;
    const p = shot.tick(dt);
    const T = p >= 0 ? p * shot.dur : -1;
    const on = T >= 0;

    // Gezegenin genel hareketi
    group.position.y = Math.sin(t * 0.9) * 0.04 * rm;
    planet.rotation.y = Math.sin(t * 0.21) * 0.22 * rm + 0.15;
    planet.rotation.z = Math.sin(t * 0.33 + 1) * 0.04 * rm;

    // --- Poke zaman çizelgesi ---
    let lidTarget = 0;
    let roll = 0;
    let lookAtHand = 0;
    let eyeLit = 0;
    let hop = 0;
    if (on) {
      lidTarget = smooth(0.0, 0.3, T) * (1 - smooth(2.5, 2.8, T));
      roll = smooth(0.25, 0.55, T) * (1 - smooth(0.9, 1.2, T)) + smooth(1.95, 2.15, T) * (1 - smooth(2.4, 2.7, T));
      lookAtHand = smooth(0.7, 1.0, T) * (1 - smooth(1.6, 1.9, T));
      eyeLit = smooth(2.65, 2.8, T) * (1 - smooth(3.1, 3.5, T));
      hop = T > 2.75 && T < 3.25 ? Math.sin(((T - 2.75) / 0.5) * Math.PI) : 0;
    }
    lidA += (lidTarget - lidA) * Math.min(1, dt * 14);
    lid.rotation.x = -2.0 * lidA;

    // kafa: etrafına bakınma / kameraya bakma / poke sırasında eğilme
    const wander = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 1.9 + 2) * 0.2 + (Math.sin(t * 0.31) > 0.85 ? 0.35 : 0);
    let lyT = wander * (1 - hv) * rm + 0.12 * hv;
    let lxT = (Math.sin(t * 0.53 + 1) * 0.12 - 0.05) * (1 - hv) * rm - 0.12 * hv;
    if (on) {
      const m = Math.max(roll, lookAtHand);
      lyT = lyT * (1 - m) + 0.55 * lookAtHand;
      lxT = lxT * (1 - m) + 0.25 * roll - 0.2 * lookAtHand;
    }
    lookY += (lyT - lookY) * Math.min(1, dt * 5);
    lookX += (lxT - lookX) * Math.min(1, dt * 5);
    head.rotation.set(lookX, lookY, -0.32 * roll + Math.sin(t * 1.3) * 0.04 * rm);

    // göz kırpma
    blinkT -= dt;
    if (blinkT < 0) {
      blink = 0.18;
      blinkT = 2 + Math.abs(Math.sin(t * 7.3)) * 3;
    }
    blink = Math.max(0, blink - dt);
    const bl = blink > 0 ? Math.sin((blink / 0.18) * Math.PI) : 0;
    eyes.scale.set(1 + eyeLit * 0.15, Math.max(0.08, 1 - bl) * (1 + eyeLit * 0.15), 1);
    eyeGlowMat.opacity = Math.max(eyeLit * 0.9, s.night * 0.15);

    // gövde: hafif nefes + sevinç zıplaması
    torso.position.y = hop * 0.08 + Math.sin(t * 2.2) * 0.004;
    torso.rotation.x = -0.05 + Math.sin(t * 0.8) * 0.03 * rm - hop * 0.15;
    chestGlowMat.opacity = 0.55 + 0.35 * Math.sin(t * 3.2) + flash * 0.5;

    // bacak sallama
    const swing = (1.2 + hv * 1.0) * (s.reduce ? 0.3 : 1);
    const kick = hop * 0.7;
    kneeR.rotation.x = -0.45 - Math.sin(t * 3.1 * swing) * 0.35 * rm - kick;
    kneeL.rotation.x = -0.45 - Math.sin(t * 3.1 * swing + Math.PI) * 0.35 * rm - kick;

    // --- kollar ---
    robot.updateMatrixWorld(true);
    headSlot.getWorldPosition(headT);
    torso.worldToLocal(headT);
    socket.getWorldPosition(sockT);
    torso.worldToLocal(sockT);
    sockT.y += 0.03;
    // sol kol: dinlenme, hafif parmak tıklatma
    tgtL.copy(restL);
    tgtL.y += Math.max(0, Math.sin(t * 2.4)) * 0.02 * rm;
    solve(armL, tgtL);
    // sağ kol: hover'da el sallar
    waveT.set(0.3, 0.42 + Math.sin(t * 9) * 0.03, 0.12 + Math.sin(t * 9) * 0.05);
    lerpTo(tgtR, restR, waveT, on ? 0 : hv);
    if (on) {
      if (T < 0.25) tgtR.copy(restR);
      else if (T < 0.65) lerpTo(tgtR, restR, headT, ease.inOut(smooth(0.25, 0.65, T)));
      else if (T < 0.75) tgtR.copy(headT);
      else if (T < 1.15) lerpTo(tgtR, headT, showP, ease.inOut(smooth(0.75, 1.15, T)));
      else if (T < 1.5) lerpTo(tgtR, showP, sockT, ease.inOut(smooth(1.15, 1.5, T)));
      else if (T < 1.95) tgtR.copy(sockT);
      else if (T < 2.3) lerpTo(tgtR, sockT, headT, ease.inOut(smooth(1.95, 2.3, T)));
      else if (T < 2.6) lerpTo(tgtR, headT, restR, ease.inOut(smooth(2.3, 2.6, T)));
      else tgtR.copy(restR);
      if (T > 1.15 && T < 1.5) tgtR.y += Math.sin(smooth(1.15, 1.5, T) * Math.PI) * 0.08;
    }
    solve(armR, tgtR);

    // --- minik beyinlerin yeri ---
    if (on) {
      wasOn = true;
      if (T < 0.65) place(inHead, headSlot);
      else if (T < 1.5) place(inHead, armR.grip, -0.01);
      else place(inHead, socket, -0.11 * smooth(1.5, 1.85, T));
      inHead.visible = T <= 1.85;
      if (T < 1.6) {
        place(inPlanet, socket, -0.11);
        inPlanet.visible = false;
      } else if (T < 1.9) {
        place(inPlanet, socket, -0.11 + 0.11 * ease.outBack(smooth(1.6, 1.9, T)));
        inPlanet.visible = true;
      } else if (T < 2.3) place(inPlanet, armR.grip, -0.01);
      else place(inPlanet, headSlot);
      if (T >= 1.5 && T < 1.6 && flash < 0.5) {
        flash = 1;
        pulseBoost = 1;
        for (const q of P) {
          q.u = 0;
          q.delay = 0;
        }
      }
      socketGlowMat.opacity = smooth(1.4, 1.6, T) * (1 - smooth(1.95, 2.3, T)) * 0.9;
      inPlanet.rotation.y = T * 2;
      haloMat.opacity = smooth(0.55, 0.75, T) * (1 - smooth(2.2, 2.45, T)) * (0.75 + 0.25 * Math.sin(t * 12));
    } else {
      if (wasOn) {
        // bitti: roller yer değiştirdi
        wasOn = false;
        const tmpB = inHead;
        inHead = inPlanet;
        inPlanet = tmpB;
      }
      place(inHead, headSlot);
      place(inPlanet, socket, -0.11);
      inHead.visible = true;
      inPlanet.visible = false;
      inHead.rotation.y = 0;
      socketGlowMat.opacity = 0;
      haloMat.opacity = 0;
    }
    flash = Math.max(0, flash - dt * 1.1);
    pulseBoost = Math.max(0, pulseBoost - dt * 0.6);

    // --- kamera yönlü billboard dönüşü (gezegen uzayında) ---
    s.camera.getWorldQuaternion(camQ);
    planet.updateMatrixWorld();
    planet.getWorldQuaternion(tq).invert().multiply(camQ);

    // parıltılar
    const sparkAmp = 1 + hv * 0.6 + flash * 1.5;
    for (let i = 0; i < SPARK; i++) {
      const ph = t * (1.3 + (i % 5) * 0.37) * (s.reduce ? 0.3 : 1) + i * 2.17;
      const k = Math.max(0, Math.sin(ph)) ** 6;
      const sc = (0.04 + 0.11 * k) * sparkAmp;
      tm.compose(sparkPos[i], tq, ts.set(sc, sc, sc));
      sparks.setMatrixAt(i, tm);
    }
    sparks.instanceMatrix.needsUpdate = true;
    sparkMat.opacity = 0.65 + 0.35 * s.night;

    // nöron ışıkları
    const pspeed = (1 + hv * 1.2 + pulseBoost * 2.5) * (s.reduce ? 0.3 : 1);
    for (let i = 0; i < NP; i++) {
      const q = P[i];
      if (q.delay > 0) q.delay -= dt * (1 + hv * 2);
      else {
        q.u += dt * q.speed * pspeed * (20 / q.path.length);
        if (q.u >= 1) {
          q.flash = 1;
          q.u = 0;
          q.delay = 0.3 + ((i * 0.618 + t) % 1) * 1.8 * (1 - hv * 0.7);
          q.path = longPaths[(Math.floor(t * 13.7) + i * 7) % longPaths.length];
          q.dir = -q.dir;
        }
      }
      q.flash = Math.max(0, q.flash - dt * 2.5);
      const active = q.delay > 0 ? 0 : 1;
      for (let k = 0; k <= TRAIL; k++) {
        let sc: number;
        if (k < TRAIL) {
          const u = q.u - k * 0.035;
          pathPoint(q.path, q.dir > 0 ? u : 1 - u, tv);
          sc = active * (u > 0 ? 1 : 0) * (0.2 - k * 0.04) * (1 + flash * 0.6);
        } else {
          pathPoint(q.path, q.dir > 0 ? 1 : 0, tv);
          sc = q.flash * 0.38;
        }
        sc += 1e-4;
        tm.compose(tv, tq, ts.set(sc, sc, sc));
        pulses.setMatrixAt(i * (TRAIL + 1) + k, tm);
      }
    }
    pulses.instanceMatrix.needsUpdate = true;
    dotMat.opacity = 0.85 + 0.15 * s.night;

    // kıvrımların parlaklığı / gece
    wormMat.emissiveIntensity = 0.05 + s.night * 0.12 + flash * 0.22 + hv * 0.05;
    baseMat.emissiveIntensity = 0.3 + s.night * 0.35 + flash * 0.5;

    // anten ışıkları
    lid.getWorldQuaternion(tq2).invert().multiply(camQ);
    for (let i = 0; i < 2; i++) {
      const k = 0.5 + 0.5 * Math.sin(t * 4 + i * Math.PI);
      const sc = 0.07 + 0.05 * k + eyeLit * 0.12 + hv * 0.03;
      tm.compose(antTips[i], tq2, ts.set(sc, sc, sc));
      antGlow.setMatrixAt(i, tm);
    }
    antGlow.instanceMatrix.needsUpdate = true;
    antMat.opacity = 0.5 + 0.3 * s.night + eyeLit * 0.4;

    // galaksiler
    group.getWorldQuaternion(tq2).invert().multiply(camQ);
    for (let i = 0; i < 2; i++) {
      const a = t * (0.25 + i * 0.12) * rm + i * Math.PI;
      tv2.set(Math.cos(a) * 1.55, 0.35 * Math.sin(a + i) - 0.2 + i * 0.5, Math.sin(a) * 1.25);
      qa.setFromAxisAngle(tv.set(0, 0, 1), t * (0.6 + i * 0.3));
      qf.copy(tq2).multiply(qa);
      const sc = 0.32 - i * 0.06;
      tm.compose(tv2, qf, ts.set(sc, sc, sc));
      gals.setMatrixAt(i, tm);
    }
    gals.instanceMatrix.needsUpdate = true;
    galMat.opacity = 0.65 + 0.3 * s.night;
  };

  return {
    group,
    update,
    poke() {
      if (shot.on) return;
      shot.start();
    },
  };
}
