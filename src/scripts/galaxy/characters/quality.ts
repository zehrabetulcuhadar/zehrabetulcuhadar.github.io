import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  clay,
  glow,
  canvasTexture,
  PAL,
  damp,
  smooth,
  ease,
  OneShot,
  clamp01,
  type Character,
  type CharacterState,
} from './kit';

/**
 * Kalite (test, kod incelemesi): uğur böceği gezegen.
 * Kırmızı kanat kabukları, sevimli yüz, halkada filizlenen yeşil "tik" çiçekleri.
 * Bir büyüteç yörüngede dönüp gövdeyi tarar; gövdede koşturan küçük "bug"ı yakalayınca onu bir tike çevirir.
 * Tıklanınca: kabuklar açılır, zar kanatlar çırpar, tikler dalga halinde zıplar, "PASS" rozeti parlar.
 */

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0, order: THREE.EulerOrder = 'XYZ') =>
  new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, order));
const wrap = (a: number) => {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
};
/** 0 → 1 → 0 tepe. */
const hill = (p: number, a: number, b: number) => {
  const m = (a + b) / 2;
  return smooth(a, m, p) * (1 - smooth(m, b, p));
};

const C = {
  red: '#EF5D55',
  redIn: '#B9403F',
  lip: '#D9474A',
  dark: '#4A2D47',
  face: '#F9CDB0',
  blush: '#F59AB5',
  check: '#4FC96A',
  stem: '#3E9E5A',
  leaf: '#86D58D',
  moss: '#6CC27A',
  ring: '#A096CF',
  gold: '#EDBE4E',
  wood: '#A0664B',
  bug: '#E5463F',
};

/* ---------- geometri yardımcıları (yalnızca kurulumda) ---------- */

function paint(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, k = 1.05) {
  const geo = g.index ? g.toNonIndexed() : g;
  if (geo !== g) g.dispose();
  for (const name of Object.keys(geo.attributes)) {
    if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
  }
  const c = new THREE.Color(color).multiplyScalar(k);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function merge(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}
function place(
  g: THREE.BufferGeometry,
  p: THREE.Vector3,
  q: THREE.Quaternion = new THREE.Quaternion(),
  s: THREE.Vector3 | number = 1,
) {
  const sc = typeof s === 'number' ? V(s, s, s) : s;
  return g.applyMatrix4(new THREE.Matrix4().compose(p, q, sc));
}
/** a → b arası kapsül. */
function seg(a: THREE.Vector3, b: THREE.Vector3, r: number, rs = 8) {
  const d = b.clone().sub(a);
  const g = new THREE.CapsuleGeometry(r, d.length(), 3, rs);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
/** Tepe noktası boyunca vertex rengi kullanan kil malzeme. */
function vclay(emissive = 0.05) {
  const m = (clay(PAL.white) as THREE.MeshStandardMaterial).clone();
  m.vertexColors = true;
  m.emissive.set('#ffffff');
  m.emissiveIntensity = emissive;
  return m;
}

const _x = V();
const _y = V();
const _z = V();
const _m = new THREE.Matrix4();
/** up (y) ve ileri (z) ipucundan yönelim. */
function basisQ(up: THREE.Vector3, fwd: THREE.Vector3, out: THREE.Quaternion) {
  _y.copy(up).normalize();
  _z.copy(fwd).addScaledVector(_y, -fwd.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(1, 0, 0).addScaledVector(_y, -_y.x);
  _z.normalize();
  _x.crossVectors(_y, _z);
  _m.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m);
}

/** Kabuk yüzeyi parametreleri: kutup önde (+Z). */
const SP = (th: number, ph: number, r: number) =>
  V(-r * Math.cos(ph) * Math.sin(th), -r * Math.sin(ph) * Math.sin(th), r * Math.cos(th));

/** Saplı yeşil tik filizi: tabanı orijinde, yukarı +Y, yüzü +Z. */
function sproutGeo() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(paint(new THREE.CylinderGeometry(0.013, 0.02, 0.14, 6).translate(-0.03, 0.07, 0), C.stem));
  parts.push(
    paint(place(new THREE.SphereGeometry(1, 6, 4), V(0.02, 0.05, 0), Q(0, 0, -0.8), V(0.05, 0.02, 0.028)), C.leaf),
  );
  parts.push(
    paint(place(new THREE.SphereGeometry(1, 6, 4), V(-0.075, 0.04, 0), Q(0, 0, 0.8), V(0.04, 0.017, 0.024)), C.leaf),
  );
  const A = V(-0.11, 0.22, 0.0);
  const B = V(-0.035, 0.14, 0.0);
  const D = V(0.125, 0.33, 0.0);
  parts.push(paint(seg(A, B, 0.034, 6), C.check));
  parts.push(paint(seg(B, D, 0.034, 6), C.check));
  return merge(parts);
}

function starShape(ro: number, ri: number, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * TAU + Math.PI / 2;
    const r = i % 2 ? ri : ro;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

export default function create(): Character {
  const group = new THREE.Group();
  const vm = vclay();

  /* ================= GÖVDE ================= */
  const bodyRoot = new THREE.Group();
  group.add(bodyRoot);

  // koyu gövde + ön göğüs (pronotum) üzerindeki iki krem leke + karın çizgileri
  {
    const parts: THREE.BufferGeometry[] = [paint(new THREE.SphereGeometry(1, 40, 26), C.dark)];
    for (let i = 0; i < 3; i++) {
      const y = -0.62 - i * 0.12;
      const r = Math.sqrt(1 - y * y);
      parts.push(paint(new THREE.TorusGeometry(r, 0.018, 6, 48).rotateX(Math.PI / 2).translate(0, y, 0), '#634060'));
    }
    bodyRoot.add(new THREE.Mesh(merge(parts), vm));
  }

  // ---- bacaklar: 6 adet, üçlü yürüyüş ----
  const legGeo = (() => {
    const a = V(0, 0, 0);
    const b = V(0.34, -0.04, 0.03);
    const c = V(0.46, -0.36, 0.07);
    return merge([
      paint(seg(a, b, 0.04), C.dark),
      paint(seg(b, c, 0.034), C.dark),
      paint(place(new THREE.SphereGeometry(0.05, 8, 6), c, undefined, V(1, 0.6, 1.3)), '#5E3B5A'),
    ]);
  })();
  const legs = new THREE.InstancedMesh(legGeo, vm, 6);
  const legAttach = [V(0.5, -0.62, 0.38), V(0.6, -0.6, 0), V(0.5, -0.62, -0.38)];
  const legDefs: { p: THREE.Vector3; yaw: number; ph: number }[] = [];
  legAttach.forEach((p, i) => {
    legDefs.push({ p, yaw: [0.35, 0, -0.35][i], ph: i % 2 ? Math.PI : 0 });
    legDefs.push({ p: V(-p.x, p.y, -p.z), yaw: Math.PI + [0.35, 0, -0.35][i], ph: i % 2 ? 0 : Math.PI });
  });
  bodyRoot.add(legs);

  // ---- baş ----
  const head = new THREE.Group();
  head.position.set(0, -0.1, 0.88);
  bodyRoot.add(head);
  {
    const parts: THREE.BufferGeometry[] = [paint(new THREE.SphereGeometry(0.46, 32, 22), C.dark)];
    parts.push(
      paint(place(new THREE.SphereGeometry(1, 32, 20), V(0, -0.04, 0.34), undefined, V(0.36, 0.33, 0.13)), C.face),
    );
    for (const sx of [-1, 1]) {
      parts.push(
        paint(
          place(
            new THREE.SphereGeometry(1, 12, 8),
            V(sx * 0.22, -0.08, 0.44),
            Q(0, sx * 0.4, 0),
            V(0.055, 0.035, 0.018),
          ),
          C.blush,
        ),
      );
    }
    parts.push(
      paint(
        place(new THREE.TorusGeometry(0.055, 0.013, 6, 16, Math.PI), V(0, -0.08, 0.465), Q(-0.2, 0, Math.PI)),
        PAL.ink,
      ),
    );
    head.add(new THREE.Mesh(merge(parts), vm));
  }
  const eyes = new THREE.Group();
  eyes.position.set(0, 0.03, 0.46);
  head.add(eyes);
  {
    const parts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      parts.push(
        paint(
          place(new THREE.SphereGeometry(1, 16, 12), V(sx * 0.125, 0, 0), undefined, V(0.056, 0.066, 0.03)),
          PAL.ink,
        ),
      );
      parts.push(
        paint(new THREE.SphereGeometry(0.016, 8, 6).translate(sx * 0.125 + 0.018, 0.024, 0.026), PAL.white, 1.3),
      );
    }
    eyes.add(new THREE.Mesh(merge(parts), vm));
  }
  const antennae: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 0.14, 0.38, 0.14);
    const pts = [V(0, 0, 0), V(sx * 0.07, 0.15, 0.05), V(sx * 0.2, 0.28, 0.1)];
    const tip = V(sx * 0.22, 0.3, 0.11);
    const geo = merge([
      paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 6), C.dark),
      paint(new THREE.SphereGeometry(0.052, 12, 8).translate(tip.x, tip.y, tip.z), C.dark),
      paint(
        new THREE.SphereGeometry(0.016, 6, 4).translate(tip.x - 0.015, tip.y + 0.025, tip.z + 0.03),
        PAL.white,
        1.2,
      ),
    ]);
    g.add(new THREE.Mesh(geo, vm));
    head.add(g);
    antennae.push(g);
  }

  // ---- kanat kabukları (elytra) ----
  const checkGeo = sproutGeo();
  type ShellCheck = { p: THREE.Vector3; q: THREE.Quaternion; s: number; d: number };
  const shells: { pivot: THREE.Group; side: number; checks: THREE.InstancedMesh; defs: ShellCheck[] }[] = [];
  const GAP = 0.018;
  const LEN = Math.PI / 2 + 0.68;
  const TH0 = 0.52;
  const phiOf = (side: number, u: number) => (side > 0 ? Math.PI * 1.5 - GAP - u : Math.PI * 1.5 + GAP + u);
  for (const side of [1, -1]) {
    const pivot = new THREE.Group();
    const H = V(side * 0.05, 0.52, 0.9);
    pivot.position.copy(H);
    pivot.rotation.order = 'ZYX';
    bodyRoot.add(pivot);
    const off = new THREE.Group();
    off.position.copy(H).multiplyScalar(-1);
    pivot.add(off);

    const phiStart = side > 0 ? phiOf(side, LEN) : phiOf(side, 0);
    const outer = new THREE.SphereGeometry(1.06, 36, 26, phiStart, LEN, TH0, Math.PI - TH0).rotateX(Math.PI / 2);
    const inner = new THREE.SphereGeometry(1.02, 22, 14, phiStart, LEN, TH0, Math.PI - TH0).rotateX(Math.PI / 2);
    {
      const idx = inner.index!;
      for (let i = 0; i < idx.count; i += 3) {
        const t = idx.getX(i);
        idx.setX(i, idx.getX(i + 2));
        idx.setX(i + 2, t);
      }
      const n = inner.attributes.normal;
      for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    }
    const parts: THREE.BufferGeometry[] = [paint(outer, C.red), paint(inner, C.redIn)];
    const loop: THREE.Vector3[] = [];
    const N = 14;
    for (let i = 0; i <= N; i++) loop.push(SP(TH0, phiOf(side, (i / N) * LEN), 1.04));
    for (let i = 1; i <= N; i++) loop.push(SP(TH0 + (i / N) * (Math.PI - TH0 - 0.06), phiOf(side, LEN), 1.04));
    for (let i = N; i >= 1; i--) loop.push(SP(TH0 + (i / N) * (Math.PI - TH0 - 0.06), phiOf(side, 0), 1.04));
    parts.push(paint(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loop, true), 130, 0.026, 5, true), C.lip));
    const spots: [number, number, number][] = [
      [0.86, 0.02, 0.13],
      [1.08, 0.66, 0.18],
      [1.68, 1.15, 0.2],
      [2.25, 0.5, 0.17],
      [1.3, 1.85, 0.14],
      [0.72, 1.45, 0.11],
    ];
    for (const [th, u, s] of spots) {
      const d = SP(th, phiOf(side, u), 1);
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), d);
      parts.push(
        paint(place(new THREE.SphereGeometry(1, 16, 8), d.multiplyScalar(1.058), q, V(s, s, 0.22 * s)), C.dark),
      );
    }
    off.add(new THREE.Mesh(merge(parts), vm));

    const defs: ShellCheck[] = [];
    const spotsC: [number, number][] = [
      [1.45, 0.3],
      [1.0, 1.1],
      [1.95, 0.95],
      [1.6, 1.75],
    ];
    spotsC.forEach(([th, u], i) => {
      const d = SP(th, phiOf(side, u), 1);
      const q = basisQ(d, V(0, 0.3, 1), new THREE.Quaternion());
      defs.push({
        p: d.clone().multiplyScalar(1.05),
        q,
        s: 0.62 + (i % 2) * 0.12,
        d: 0.12 + i * 0.07 + (side > 0 ? 0.03 : 0),
      });
    });
    const checks = new THREE.InstancedMesh(checkGeo, vm, defs.length);
    off.add(checks);
    shells.push({ pivot, side, checks, defs });
  }

  // ---- zar kanatlar (normalde kabuk altında katlı) ----
  const wingTex = canvasTexture(128, 256, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,240,250,0.95)');
    g.addColorStop(1, 'rgba(214,200,255,0.85)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(120,90,150,0.55)';
    x.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      x.moveTo(w * 0.5, 0);
      x.quadraticCurveTo(w * (0.2 + i * 0.15), h * 0.5, w * (0.1 + i * 0.2), h);
      x.stroke();
    }
    x.lineWidth = 2;
    for (let j = 1; j < 6; j++) {
      x.beginPath();
      x.moveTo(0, (h * j) / 6);
      x.quadraticCurveTo(w * 0.5, (h * j) / 6 - 14, w, (h * j) / 6);
      x.stroke();
    }
  });
  const wingMat = new THREE.MeshStandardMaterial({
    map: wingTex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    roughness: 0.5,
    emissive: '#ffffff',
    emissiveIntensity: 0.3,
  });
  const wingGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.28, 0.12, 0.36, 0.75, 0.14, 1.25);
    s.bezierCurveTo(0.04, 1.4, -0.14, 1.05, -0.12, 0.6);
    s.bezierCurveTo(-0.1, 0.3, -0.05, 0.1, 0, 0);
    const g = new THREE.ShapeGeometry(s, 20);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + 0.14) / 0.5, p.getY(i) / 1.4);
    g.rotateX(-Math.PI / 2);
    return g;
  })();
  const wings: { g: THREE.Group; side: number }[] = [];
  for (const side of [1, -1]) {
    const g = new THREE.Group();
    g.position.set(side * 0.12, 0.62, 0.6);
    g.rotation.order = 'ZYX';
    const m = new THREE.Mesh(wingGeo, wingMat);
    if (side < 0) m.scale.x = -1;
    g.add(m);
    g.visible = false;
    bodyRoot.add(g);
    wings.push({ g, side });
  }

  /* ================= HALKA (test pisti) ================= */
  const ringTilt = new THREE.Group();
  ringTilt.rotation.set(0.3, 0, -0.1);
  group.add(ringTilt);
  const ringSpin = new THREE.Group();
  ringTilt.add(ringSpin);
  {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(paint(new THREE.TorusGeometry(1.5, 0.14, 10, 96).rotateX(Math.PI / 2).scale(1, 0.3, 1), C.ring));
    for (const r of [1.385, 1.615]) {
      parts.push(paint(new THREE.TorusGeometry(r, 0.014, 4, 96).rotateX(Math.PI / 2).translate(0, 0.03, 0), '#C8BEEF'));
    }
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * TAU;
      const g = new THREE.BoxGeometry(0.075, 0.012, 0.02);
      parts.push(paint(place(g, V(Math.cos(a) * 1.5, 0.042, Math.sin(a) * 1.5), Q(0, -a + Math.PI / 2, 0)), PAL.cream));
    }
    ringSpin.add(new THREE.Mesh(merge(parts), vm));
  }
  const ringChecks: { p: THREE.Vector3; q: THREE.Quaternion; s: number; a: number }[] = [];
  const mossM: THREE.Matrix4[] = [];
  const mossC: THREE.Color[] = [];
  const mossCols = [C.moss, PAL.leaf, PAL.mint, '#5DB46B'];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const NCH = 11;
  for (let i = 0; i < NCH; i++) {
    const a = (i / NCH) * TAU + 0.2;
    const r = 1.5 + (i % 2 ? 0.06 : -0.06);
    ringChecks.push({
      p: V(Math.cos(a) * r, 0.03, Math.sin(a) * r),
      q: Q(0, Math.PI / 2 - a, (i % 3) * 0.12 - 0.12),
      s: 0.95,
      a,
    });
    for (let k = 0; k < 5; k++) {
      const aa = a + (rnd() - 0.5) * 0.14;
      const rr = r + (rnd() - 0.5) * 0.12;
      const sc = 0.03 + rnd() * 0.025;
      mossM.push(
        new THREE.Matrix4().compose(
          V(Math.cos(aa) * rr, 0.04, Math.sin(aa) * rr),
          new THREE.Quaternion(),
          V(sc, sc * 0.75, sc),
        ),
      );
      mossC.push(new THREE.Color(mossCols[k % 4]));
    }
  }
  for (let i = 0; i < 26; i++) {
    const aa = rnd() * TAU;
    const rr = 1.4 + rnd() * 0.2;
    const sc = 0.022 + rnd() * 0.02;
    mossM.push(
      new THREE.Matrix4().compose(
        V(Math.cos(aa) * rr, 0.04, Math.sin(aa) * rr),
        new THREE.Quaternion(),
        V(sc, sc * 0.8, sc),
      ),
    );
    mossC.push(new THREE.Color(mossCols[i % 4]));
  }
  const moss = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), clay(PAL.white), mossM.length);
  mossM.forEach((m, i) => {
    moss.setMatrixAt(i, m);
    moss.setColorAt(i, mossC[i]);
  });
  ringSpin.add(moss);
  {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.55;
      const r = 1.5 + (i % 2 ? -0.08 : 0.08);
      const g = new THREE.ExtrudeGeometry(starShape(0.055, 0.025), {
        depth: 0.015,
        bevelEnabled: true,
        bevelSize: 0.008,
        bevelThickness: 0.008,
        bevelSegments: 1,
      });
      g.rotateX(-Math.PI / 2);
      parts.push(paint(place(g, V(Math.cos(a) * r, 0.045, Math.sin(a) * r), Q(0, a * 2, 0)), PAL.butter));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.95;
      const r = 1.5 + (i % 2 ? 0.07 : -0.07);
      const gp: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.04, 0.04, 0.022, 14)];
      for (let k = 0; k < 8; k++) {
        const ka = (k / 8) * TAU;
        gp.push(
          place(
            new THREE.BoxGeometry(0.022, 0.022, 0.02),
            V(Math.cos(ka) * 0.046, 0, Math.sin(ka) * 0.046),
            Q(0, -ka, 0),
          ),
        );
      }
      gp.push(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 8));
      const merged = merge(gp.map((g) => paint(g, i === 2 ? PAL.periwinkle : PAL.apricot)));
      parts.push(place(merged, V(Math.cos(a) * r, 0.055, Math.sin(a) * r), Q(0.15, 0, 0.1)));
    }
    ringSpin.add(new THREE.Mesh(merge(parts), vm));
  }
  const ringCheckMesh = new THREE.InstancedMesh(checkGeo, vm, NCH);
  ringSpin.add(ringCheckMesh);

  /* ================= BÜYÜTEÇ + BUG (eğik yörünge) ================= */
  const orbit = new THREE.Group();
  orbit.rotation.set(-0.45, 0, 0.18);
  group.add(orbit);

  const mag = new THREE.Group();
  orbit.add(mag);
  const magInner = new THREE.Group();
  mag.add(magInner);
  const LENS_R = 0.25;
  {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(paint(new THREE.TorusGeometry(LENS_R, 0.045, 10, 40), C.gold));
    parts.push(paint(new THREE.TorusGeometry(LENS_R - 0.035, 0.012, 6, 40).translate(0, 0, 0.03), '#F7DA8A'));
    const top = -LENS_R - 0.03;
    parts.push(paint(new THREE.CylinderGeometry(0.035, 0.04, 0.09, 12).translate(0, top - 0.03, 0), C.gold));
    parts.push(paint(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 14).translate(0, top - 0.095, 0), C.gold));
    parts.push(paint(new THREE.CapsuleGeometry(0.052, 0.3, 4, 12).translate(0, top - 0.29, 0), C.wood));
    for (const y of [top - 0.2, top - 0.38]) {
      parts.push(
        paint(new THREE.TorusGeometry(0.055, 0.008, 5, 18).rotateX(Math.PI / 2).translate(0, y, 0), '#7E4C37'),
      );
    }
    parts.push(paint(new THREE.SphereGeometry(0.045, 12, 8).translate(0, top - 0.47, 0), C.gold));
    magInner.add(new THREE.Mesh(merge(parts), vm));
  }
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(LENS_R - 0.01, 32),
    new THREE.MeshStandardMaterial({
      color: '#D8F1FF',
      transparent: true,
      opacity: 0.32,
      roughness: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      emissive: '#BFE8FF',
      emissiveIntensity: 0.25,
    }),
  );
  magInner.add(glass);
  const glintMat = glow('#ffffff', 0.7);
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.3), glintMat);
  glint.rotation.z = -0.7;
  magInner.add(glint);
  const glint2 = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.16), glintMat);
  glint2.rotation.z = -0.7;
  magInner.add(glint2);
  const flashMat = glow(PAL.coral, 0);
  const flashRing = new THREE.Mesh(new THREE.TorusGeometry(LENS_R + 0.05, 0.03, 8, 40), flashMat);
  magInner.add(flashRing);
  const beamMat = glow('#A8F5D8', 0.12);
  beamMat.side = THREE.DoubleSide;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(LENS_R - 0.02, 1, 28, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    beamMat,
  );
  magInner.add(beam);
  const spotMat = glow('#C9FFE9', 0.35);
  const scanSpot = new THREE.Mesh(new THREE.CircleGeometry(0.07, 20), spotMat);
  orbit.add(scanSpot);

  // küçük "bug"
  const bug = new THREE.Group();
  orbit.add(bug);
  const bugBody = new THREE.Group();
  bug.add(bugBody);
  {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(
      paint(place(new THREE.SphereGeometry(1, 14, 10), V(0, 0.045, -0.01), undefined, V(0.06, 0.045, 0.075)), C.bug),
    );
    parts.push(paint(new THREE.BoxGeometry(0.006, 0.02, 0.13).translate(0, 0.085, -0.01), PAL.ink));
    parts.push(paint(new THREE.SphereGeometry(0.036, 10, 8).translate(0, 0.04, 0.072), PAL.ink));
    for (const sx of [-1, 1]) {
      parts.push(paint(new THREE.SphereGeometry(0.012, 6, 4).translate(sx * 0.016, 0.055, 0.1), PAL.white, 1.3));
      parts.push(paint(seg(V(sx * 0.012, 0.065, 0.09), V(sx * 0.045, 0.1, 0.14), 0.005, 4), PAL.ink));
      for (let k = 0; k < 3; k++) {
        const z = 0.04 - k * 0.045;
        parts.push(paint(seg(V(sx * 0.04, 0.03, z), V(sx * 0.085, 0.0, z + 0.01 * (1 - k)), 0.007, 4), PAL.ink));
      }
    }
    bugBody.add(new THREE.Mesh(merge(parts), vm));
  }
  const popCheck = new THREE.Mesh(checkGeo, vm);
  popCheck.scale.setScalar(0.001);
  orbit.add(popCheck);

  /* ================= PASS rozeti + kıvılcımlar ================= */
  const badgeTex = canvasTexture(512, 200, (x, w, h) => {
    x.fillStyle = '#4FC96A';
    x.beginPath();
    x.roundRect(14, 14, w - 28, h - 28, 70);
    x.fill();
    x.lineWidth = 12;
    x.strokeStyle = '#EFFFF1';
    x.stroke();
    x.fillStyle = '#ffffff';
    x.font = 'bold 112px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('PASS', w * 0.42, h / 2 + 6);
    x.strokeStyle = '#ffffff';
    x.lineWidth = 22;
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(w * 0.74, h * 0.52);
    x.lineTo(w * 0.8, h * 0.66);
    x.lineTo(w * 0.9, h * 0.34);
    x.stroke();
  });
  const badgeMat = new THREE.MeshBasicMaterial({
    map: badgeTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.33), badgeMat);
  badge.position.set(0, 1.6, 0.45);
  badge.renderOrder = 3;
  group.add(badge);
  const sparkTex = canvasTexture(64, 64, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,170,0.8)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(w / 2, 0);
    x.quadraticCurveTo(w / 2, h / 2, w, h / 2);
    x.quadraticCurveTo(w / 2, h / 2, w / 2, h);
    x.quadraticCurveTo(w / 2, h / 2, 0, h / 2);
    x.quadraticCurveTo(w / 2, h / 2, w / 2, 0);
    x.fill();
  });
  const sparkMat = new THREE.MeshBasicMaterial({
    map: sparkTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    depthTest: false,
  });
  const NSP = 12;
  const sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.16), sparkMat, NSP);
  sparks.renderOrder = 4;
  sparks.frustumCulled = false;
  group.add(sparks);
  const sparkDir = Array.from({ length: NSP }, (_, i) => {
    const a = (i / NSP) * TAU;
    return V(Math.cos(a) * (0.55 + (i % 3) * 0.12), Math.sin(a) * (0.32 + (i % 2) * 0.1), 0);
  });

  /* ================= durum ================= */
  const pk = new OneShot(2.8);
  let open = 0;
  let wingOpen = 0;
  let aM = -0.5;
  let aB = 0.4;
  let prevDiff = wrap(aM - aB);
  let catchT = -1;
  let bugScale = 1;
  let popLife = 0;
  let hoverS = 0;
  let blinkT = 2.2;
  let bugR = 1.1;
  const popPos = V();
  const popQ = new THREE.Quaternion();

  const mq = new THREE.Quaternion();
  const mp = V();
  const ms = V(1, 1, 1);
  const mm = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpQ2 = new THREE.Quaternion();
  const dir = V();
  const tan = V();
  const wdir = V();
  const camQ = new THREE.Quaternion();
  const Y = V(0, 1, 0);
  const Zv = V(0, 0, 1);
  const eul = new THREE.Euler();

  function setChecks(t: number, p: number, hv: number) {
    for (let i = 0; i < NCH; i++) {
      const c = ringChecks[i];
      const delay = 0.12 + (((c.a + Math.PI * 0.5) % TAU) / TAU) * 0.35;
      const wave = p >= 0 ? hill(p, delay, delay + 0.2) : 0;
      const sw = Math.sin(t * (1.6 + hv) + i * 1.7) * (0.08 + hv * 0.1);
      eul.set(sw * 0.6, 0, sw);
      tmpQ.setFromEuler(eul);
      mq.copy(c.q).multiply(tmpQ);
      mp.copy(c.p);
      mp.y += wave * 0.12;
      ms.setScalar(c.s * (1 + wave * 0.7 + Math.sin(t * 2.3 + i) * 0.03));
      mm.compose(mp, mq, ms);
      ringCheckMesh.setMatrixAt(i, mm);
    }
    ringCheckMesh.instanceMatrix.needsUpdate = true;
    for (const sh of shells) {
      sh.defs.forEach((d, i) => {
        const wave = p >= 0 ? hill(p, d.d, d.d + 0.22) : 0;
        const sw = Math.sin(t * 1.9 + i * 2.1 + sh.side) * (0.07 + hv * 0.08);
        eul.set(0, 0, sw);
        tmpQ.setFromEuler(eul);
        mq.copy(d.q).multiply(tmpQ);
        ms.setScalar(d.s * (1 + wave * 0.8));
        mm.compose(d.p, mq, ms);
        sh.checks.setMatrixAt(i, mm);
      });
      sh.checks.instanceMatrix.needsUpdate = true;
    }
  }

  function update(s: CharacterState) {
    const dt = s.dt;
    const t = s.t;
    hoverS = damp(hoverS, s.hover, 6, dt);
    const hv = hoverS;
    const red = s.reduce;
    const sp = red ? 0.25 : 1;
    const p = pk.tick(dt);
    const pp = p >= 0 ? p : 2;

    /* ---- gövde ---- */
    const hop = p >= 0 ? hill(p, 0.06, 0.42) * 0.16 : 0;
    const squash = p >= 0 ? -hill(p, 0, 0.12) * 0.07 + hill(p, 0.12, 0.3) * 0.04 : 0;
    bodyRoot.position.y = Math.sin(t * 1.3 * sp) * 0.035 + hop;
    bodyRoot.rotation.y = Math.sin(t * 0.45 * sp) * (red ? 0.05 : 0.16);
    bodyRoot.rotation.z = Math.sin(t * 0.9 * sp + 1) * 0.03;
    bodyRoot.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);

    /* ---- kabuklar ve zar kanatlar ---- */
    const openTarget = p >= 0 ? smooth(0.04, 0.2, p) * (1 - smooth(0.7, 0.9, p)) : 0;
    open = damp(open, openTarget, 14, dt);
    for (const sh of shells) {
      sh.pivot.rotation.set(0.35 * open, sh.side * 0.45 * open, sh.side * 1.05 * open);
    }
    const wingTarget = p >= 0 ? smooth(0.12, 0.3, p) * (1 - smooth(0.62, 0.8, p)) : 0;
    wingOpen = damp(wingOpen, wingTarget, 12, dt);
    for (const w of wings) {
      w.g.visible = wingOpen > 0.02;
      if (!w.g.visible) continue;
      const flap = Math.sin(t * 26) * 0.32 * wingOpen;
      w.g.scale.setScalar(0.3 + 1.0 * wingOpen);
      w.g.rotation.set(0.1 + 0.2 * wingOpen, -w.side * (0.2 + 0.9 * wingOpen), w.side * (0.15 * wingOpen + flap));
    }

    /* ---- bacaklar ---- */
    const gait = t * (red ? 1 : 5 + hv * 4);
    legDefs.forEach((d, i) => {
      const ph = gait + d.ph;
      eul.set(
        0,
        d.yaw + Math.sin(ph) * (red ? 0.05 : 0.22),
        -0.05 - Math.max(0, Math.cos(ph)) * 0.25 - hill(pp, 0.05, 0.5) * 0.5,
      );
      mq.setFromEuler(eul);
      ms.set(1, 1, 1);
      mm.compose(d.p, mq, ms);
      legs.setMatrixAt(i, mm);
    });
    legs.instanceMatrix.needsUpdate = true;

    /* ---- baş ---- */
    blinkT -= dt;
    if (blinkT < -0.16) blinkT = 2 + ((t * 7.31) % 2.5);
    const blink = blinkT < 0 ? Math.sin((-blinkT / 0.16) * Math.PI) : 0;
    const wide = 1 + hv * 0.15 + (p >= 0 ? hill(p, 0.1, 0.5) * 0.2 : 0);
    eyes.scale.set(wide, wide * (1 - blink * 0.9), 1);
    mag.getWorldPosition(wdir);
    head.worldToLocal(wdir);
    wdir.normalize();
    eyes.position.x = damp(eyes.position.x, THREE.MathUtils.clamp(wdir.x, -1, 1) * 0.03, 5, dt);
    eyes.position.y = damp(eyes.position.y, 0.03 + THREE.MathUtils.clamp(wdir.y, -1, 1) * 0.022, 5, dt);
    head.rotation.x = Math.sin(t * 0.8 * sp) * 0.05 - (p >= 0 ? hill(p, 0.05, 0.35) * 0.15 : 0);
    head.rotation.z = Math.sin(t * 0.6 * sp + 2) * 0.05;
    antennae.forEach((a, i) => {
      const k = i ? 1 : -1;
      const amp = (red ? 0.04 : 0.14) * (1 + hv * 1.4) + (p >= 0 ? hill(p, 0.1, 0.6) * 0.3 : 0);
      a.rotation.z = Math.sin(t * (3.2 + hv * 3) + i * 1.3) * amp * k;
      a.rotation.x = Math.sin(t * (2.1 + hv * 2) + i * 2.1) * amp * 0.7;
    });

    setChecks(t * sp, p, hv);
    ringSpin.rotation.y += dt * (0.08 + hv * 0.12) * sp;

    /* ---- büyüteç + bug avı ---- */
    const catching = catchT >= 0 ? hill(catchT, 0, 0.7) : 0;
    const magSpeed = (0.5 + hv * 0.6) * sp * (1 - 0.9 * Math.min(1, catching * 2));
    aM += dt * magSpeed;
    if (bugScale > 0.5 && catchT < 0) aB += dt * (0.2 + hv * 0.1) * sp;

    const diff = wrap(aM - aB);
    if (catchT < 0 && bugScale > 0.9 && prevDiff < 0 && diff >= 0 && diff < 0.5) catchT = 0;
    prevDiff = diff;

    dir.set(Math.sin(aM), 0, Math.cos(aM));
    tan.set(Math.cos(aM), 0, -Math.sin(aM));
    const dip = catching * 0.22;
    const magR = 1.62 - dip + Math.sin(t * 1.7) * 0.03;
    mag.position.copy(dir).multiplyScalar(magR);
    mag.position.addScaledVector(Y, Math.sin(t * 1.1) * 0.04);
    _z.copy(dir).negate();
    _y.copy(tan);
    _x.crossVectors(_y, _z);
    _m.makeBasis(_x, _y, _z);
    mag.quaternion.setFromRotationMatrix(_m);
    magInner.rotation.z = Math.sin(t * 0.9) * 0.12 + (p >= 0 ? ease.inOut(clamp01((p - 0.1) / 0.6)) * TAU : 0);
    magInner.rotation.x = Math.sin(t * 1.3) * 0.06 - catching * 0.25;
    const surf = 1.1;
    beam.scale.set(1, 1, Math.max(0.05, magR - surf - 0.02));
    const glow01 = 0.08 + s.night * 0.1 + hv * 0.06 + catching * 0.15;
    beamMat.opacity = glow01 * (0.85 + 0.15 * Math.sin(t * 9));
    scanSpot.position.copy(dir).multiplyScalar(surf + 0.012);
    scanSpot.quaternion.setFromUnitVectors(Zv, dir);
    scanSpot.scale.setScalar((1 + Math.sin(t * 6) * 0.15) * (1 + catching));
    spotMat.opacity = 0.25 + s.night * 0.25 + catching * 0.4;
    const gph = (t * 0.45) % 1;
    const gx = -0.22 + gph * 0.44;
    glint.position.set(gx, gx * 0.6, -0.012);
    glint2.position.set(gx + 0.07, gx * 0.6 - 0.04, -0.012);
    glintMat.opacity = Math.sin(gph * Math.PI) * (0.55 + s.night * 0.35);
    flashMat.opacity = catchT >= 0 ? hill(catchT, 0, 0.45) * 0.9 : 0;

    if (catchT >= 0) {
      catchT += dt / 1.6;
      if (catchT >= 0.32 && popLife <= 0) {
        popPos.copy(bug.position);
        popQ.copy(bug.quaternion);
        popLife = 3.2;
      }
      if (catchT >= 1) {
        catchT = -1;
        aB = aM + Math.PI * 0.95;
        bugScale = 0;
        prevDiff = wrap(aM - aB);
      }
    } else if (bugScale < 1) {
      bugScale = Math.min(1, bugScale + dt * 1.2);
    }
    dir.set(Math.sin(aB), 0, Math.cos(aB));
    tan.set(Math.cos(aB), 0, -Math.sin(aB));
    wdir.copy(dir).applyQuaternion(orbit.quaternion);
    const onShell = Math.acos(THREE.MathUtils.clamp(wdir.z, -1, 1)) > 0.85 && wdir.y > -0.3;
    bugR = damp(bugR, onShell ? 1.1 : 1.0, 8, dt);
    const lift = catchT >= 0 ? smooth(0.15, 0.4, catchT) * 0.18 : 0;
    bug.position.copy(dir).multiplyScalar(bugR + lift);
    basisQ(dir, tan, bug.quaternion);
    const jitter = catchT >= 0 ? (1 - smooth(0.1, 0.3, catchT)) * Math.sin(t * 60) * 0.25 : 0;
    const bs = catchT >= 0 ? 1 - smooth(0.25, 0.55, catchT) : ease.outBack(bugScale);
    bugBody.scale.setScalar(Math.max(0.001, bs * 1.25));
    bugBody.rotation.set(
      0,
      (catchT >= 0 ? smooth(0.2, 0.55, catchT) * 9 : 0) + jitter,
      catchT < 0 ? Math.sin(t * 22) * 0.06 : 0,
    );
    bugBody.position.y = catchT < 0 ? Math.abs(Math.sin(t * 22)) * 0.012 : 0;
    if (popLife > 0) {
      popLife -= dt;
      const age = 3.2 - popLife;
      const sc = ease.outBack(clamp01(age / 0.45)) * (1 - smooth(2.6, 3.2, age)) * 1.1;
      popCheck.position.copy(popPos);
      popCheck.quaternion.copy(popQ);
      popCheck.scale.setScalar(Math.max(0.001, sc));
    } else popCheck.scale.setScalar(0.001);

    /* ---- PASS rozeti ve kıvılcımlar ---- */
    group.getWorldQuaternion(camQ).invert().multiply(s.camera.quaternion);
    const bIn = p >= 0 ? clamp01((p - 0.3) / 0.25) : 0;
    const bOut = p >= 0 ? 1 - smooth(0.82, 0.97, p) : 0;
    badgeMat.opacity = Math.min(1, bIn * 3) * bOut;
    badge.visible = badgeMat.opacity > 0.01;
    badge.quaternion.copy(camQ);
    badge.scale.setScalar(Math.max(0.001, ease.outBack(bIn)) * (1 + Math.sin(t * 5) * 0.02));
    badge.position.y = 1.6 + (p >= 0 ? hill(p, 0.3, 1) * 0.06 : 0);
    const spP = p >= 0 ? clamp01((p - 0.32) / 0.45) : -1;
    sparks.visible = spP >= 0 && spP < 1;
    if (sparks.visible) {
      for (let i = 0; i < NSP; i++) {
        mp.copy(sparkDir[i])
          .multiplyScalar(0.4 + ease.out(spP) * 0.75)
          .applyQuaternion(camQ);
        mp.add(badge.position);
        tmpQ2.setFromAxisAngle(Zv, t * 3 + i);
        mq.copy(camQ).multiply(tmpQ2);
        ms.setScalar(Math.max(0.001, Math.sin(spP * Math.PI) * (0.7 + (i % 3) * 0.3)));
        mm.compose(mp, mq, ms);
        sparks.setMatrixAt(i, mm);
      }
      sparks.instanceMatrix.needsUpdate = true;
    }
  }

  update({ dt: 0.016, t: 0, hover: 0, night: 0, reduce: false, camera: new THREE.PerspectiveCamera() });

  return { group, update, poke: () => pk.start() };
}
