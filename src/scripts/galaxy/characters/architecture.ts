import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  clay,
  glow,
  rbox,
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
 * Mimari (yazılım mimarisi): renkli kil bloklardan örülen gezegen.
 * Kuzey kutbundaki paletli vinç, holografik yazıcıdan basılan bloğu alır, döner, boşluğa indirir; blok yerine oturur.
 * Üç boşluk dolunca plan "yeniden düzenlenir" (bloklar plana çözülür) ve döngü baştan başlar.
 * Etrafta mavi plan panelleri (kutu-ok diyagramları) süzülür, yanda iskele var.
 * Tıklanınca: bloklar dışarı saçılıp elastik biçimde yerine oturur, planlar parlar.
 */

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = (x = 0, y = 0, z = 0) => new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
const hill = (p: number, a: number, b: number) => {
  const m = (a + b) / 2;
  return smooth(a, m, p) * (1 - smooth(m, b, p));
};
const lerp = THREE.MathUtils.lerp;

const RM = 0.95; // blok orta yarıçapı
const TH = 0.16; // blok kalınlığı
const CAP = 69 * D2R; // kutup kapağı sınırı
const COLS = [PAL.coral, PAL.butter, PAL.mint, PAL.leaf, PAL.periwinkle, PAL.lilac, PAL.sky, PAL.pink, PAL.apricot];

/* ---------- geometri yardımcıları ---------- */
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
function seg(a: THREE.Vector3, b: THREE.Vector3, r: number, rs = 6) {
  const d = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(r, r, d.length(), rs, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}
function vclay(emissive = 0.05) {
  const m = (clay(PAL.white) as THREE.MeshStandardMaterial).clone();
  m.vertexColors = true;
  m.emissive.set('#ffffff');
  m.emissiveIntensity = emissive;
  return m;
}
/** Kürenin (enlem, boylam) noktasındaki yerel çerçeve. */
function frame(lat: number, lon: number) {
  const E = V(Math.cos(lon), 0, -Math.sin(lon));
  const N = V(-Math.sin(lat) * Math.sin(lon), Math.cos(lat), -Math.sin(lat) * Math.cos(lon));
  const U = V(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
  return { E, N, U };
}

/** Yuvarlak köşeli kutu (kenarlara yakın ek satırlarla) — bükülmeye uygun. */
function pillow(w: number, h: number, d: number, r: number, ni: [number, number, number], bottom: boolean) {
  const co = (L: number, n: number) => {
    const a = [-L / 2, -L / 2 + 0.3 * r, -L / 2 + r];
    for (let i = 1; i <= n; i++) a.push(-L / 2 + r + ((L - 2 * r) * i) / (n + 1));
    a.push(L / 2 - r, L / 2 - 0.3 * r, L / 2);
    return a;
  };
  const xs = co(w, ni[0]);
  const ys = co(h, ni[1]);
  const zs = co(d, ni[2]);
  const hx = w / 2 - r;
  const hy = h / 2 - r;
  const hz = d / 2 - r;
  const pos: number[] = [];
  const nor: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const cl = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  const face = (us: number[], vs: number[], f: (u: number, v: number) => [number, number, number]) => {
    const base = pos.length / 3;
    const nu = us.length;
    for (let j = 0; j < vs.length; j++) {
      for (let i = 0; i < nu; i++) {
        const [x, y, z] = f(us[i], vs[j]);
        const cx = cl(x, hx);
        const cy = cl(y, hy);
        const cz = cl(z, hz);
        let dx = x - cx;
        let dy = y - cy;
        let dz = z - cz;
        const L = Math.hypot(dx, dy, dz) || 1;
        dx /= L;
        dy /= L;
        dz /= L;
        pos.push(cx + dx * r, cy + dy * r, cz + dz * r);
        nor.push(dx, dy, dz);
        uv.push(i / (nu - 1), j / (vs.length - 1));
      }
    }
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < nu - 1; i++) {
        const a = base + j * nu + i;
        const b = a + 1;
        const c = a + nu;
        const e = c + 1;
        idx.push(a, b, e, a, e, c);
      }
    }
  };
  face(xs, ys, (u, v) => [u, v, d / 2]);
  if (bottom) face(ys, xs, (u, v) => [v, u, -d / 2]);
  face(ys, zs, (u, v) => [w / 2, u, v]);
  face(zs, ys, (u, v) => [-w / 2, v, u]);
  face(zs, xs, (u, v) => [v, h / 2, u]);
  face(xs, zs, (u, v) => [u, -h / 2, v]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Küre üstüne bükülmüş blok: merkezi boylam 0'da. */
function tileGeo(latC: number, dLat: number, dLon: number, bottom = false) {
  const cl = Math.cos(latC);
  const w = dLon * RM * cl - 0.03;
  const h = dLat * RM - 0.03;
  const g = pillow(w, h, TH, 0.05, [2, 1, 0], bottom);
  bend(g, latC, cl);
  return g;
}
function bend(g: THREE.BufferGeometry, latC: number, cl: number) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const lon = x / (RM * cl);
    const lat = latC + y / RM;
    const r = RM + z;
    const { E, N, U } = frame(lat, lon);
    p.setXYZ(i, U.x * r, U.y * r, U.z * r);
    const nx = n.getX(i);
    const ny = n.getY(i);
    const nz = n.getZ(i);
    n.setXYZ(i, nx * E.x + ny * N.x + nz * U.x, nx * E.y + ny * N.y + nz * U.y, nx * E.z + ny * N.z + nz * U.z);
  }
}
/** Bloğun 12 kenarı (holografik tel çerçeve). */
function tileOutline(latC: number, dLat: number, dLon: number) {
  const cl = Math.cos(latC);
  const w = (dLon * RM * cl - 0.03) / 2;
  const h = (dLat * RM - 0.03) / 2;
  const d = TH / 2 + 0.005;
  const pts: number[] = [];
  const P = (x: number, y: number, z: number) => {
    const { U } = frame(latC + y / RM, x / (RM * cl));
    return U.multiplyScalar(RM + z);
  };
  const edge = (a: number[], b: number[]) => {
    const S = 8;
    for (let i = 0; i < S; i++) {
      const t0 = i / S;
      const t1 = (i + 1) / S;
      const p0 = P(lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), lerp(a[2], b[2], t0));
      const p1 = P(lerp(a[0], b[0], t1), lerp(a[1], b[1], t1), lerp(a[2], b[2], t1));
      pts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
    }
  };
  for (const z of [-d, d]) {
    edge([-w, -h, z], [w, -h, z]);
    edge([w, -h, z], [w, h, z]);
    edge([w, h, z], [-w, h, z]);
    edge([-w, h, z], [-w, -h, z]);
  }
  for (const x of [-w, w]) for (const y of [-h, h]) edge([x, y, -d], [x, y, d]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

/** Mavi plan dokuları. */
function blueprint(kind: number) {
  return canvasTexture(256, 192, (x, w, h) => {
    x.fillStyle = 'rgba(50,130,225,0.55)';
    x.beginPath();
    x.roundRect(4, 4, w - 8, h - 8, 14);
    x.fill();
    x.strokeStyle = 'rgba(200,235,255,0.35)';
    x.lineWidth = 1;
    for (let i = 16; i < w; i += 16) {
      x.beginPath();
      x.moveTo(i, 6);
      x.lineTo(i, h - 6);
      x.stroke();
    }
    for (let j = 16; j < h; j += 16) {
      x.beginPath();
      x.moveTo(6, j);
      x.lineTo(w - 6, j);
      x.stroke();
    }
    x.strokeStyle = 'rgba(235,250,255,0.95)';
    x.fillStyle = 'rgba(235,250,255,0.95)';
    x.lineWidth = 4;
    x.beginPath();
    x.roundRect(4, 4, w - 8, h - 8, 14);
    x.stroke();
    x.lineWidth = 3;
    const box = (bx: number, by: number, bw: number, bh: number) => {
      x.beginPath();
      x.roundRect(bx, by, bw, bh, 6);
      x.stroke();
    };
    const arrow = (x0: number, y0: number, x1: number, y1: number) => {
      x.beginPath();
      x.moveTo(x0, y0);
      x.lineTo(x1, y1);
      x.stroke();
      const a = Math.atan2(y1 - y0, x1 - x0);
      x.beginPath();
      x.moveTo(x1, y1);
      x.lineTo(x1 - 10 * Math.cos(a - 0.5), y1 - 10 * Math.sin(a - 0.5));
      x.lineTo(x1 - 10 * Math.cos(a + 0.5), y1 - 10 * Math.sin(a + 0.5));
      x.closePath();
      x.fill();
    };
    if (kind === 0) {
      // servis diyagramı: kutular ve oklar
      box(98, 18, 60, 34);
      box(24, 82, 60, 34);
      box(172, 82, 60, 34);
      box(98, 140, 60, 34);
      arrow(118, 52, 64, 80);
      arrow(138, 52, 192, 80);
      arrow(64, 116, 116, 138);
      arrow(192, 116, 140, 138);
      x.fillRect(108, 30, 40, 5);
      x.fillRect(34, 94, 30, 4);
      x.fillRect(182, 94, 38, 4);
      x.fillRect(108, 152, 26, 4);
    } else if (kind === 1) {
      // küre tel çizimi + ölçü çizgileri
      x.beginPath();
      x.arc(110, 98, 64, 0, TAU);
      x.stroke();
      for (const s of [0.35, 0.7]) {
        x.beginPath();
        x.ellipse(110, 98, 64 * s, 64, 0, 0, TAU);
        x.stroke();
        x.beginPath();
        x.ellipse(110, 98, 64, 64 * s, 0, 0, TAU);
        x.stroke();
      }
      x.lineWidth = 2;
      arrow(196, 98, 196, 36);
      arrow(196, 98, 196, 160);
      x.fillRect(206, 92, 34, 4);
      x.fillRect(206, 102, 22, 4);
    } else {
      // tuğla duvar kesiti + katmanlar
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 22 : 0;
        for (let c = -1; c < 5; c++) {
          const bx = 24 + off + c * 44;
          if (bx < 20 || bx + 40 > 236) continue;
          box(bx, 22 + r * 30, 40, 24);
        }
      }
      x.setLineDash([6, 5]);
      x.beginPath();
      x.moveTo(20, 176);
      x.lineTo(236, 176);
      x.stroke();
    }
  });
}

export default function create(): Character {
  const group = new THREE.Group();
  const vm = vclay();
  const tileMat = (clay(PAL.white) as THREE.MeshStandardMaterial).clone();
  tileMat.emissiveIntensity = 0.06;

  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* ================= çekirdek ================= */
  const core = new THREE.Mesh(new THREE.SphereGeometry(RM - TH / 2 + 0.01, 36, 24), clay('#4D3F66'));
  group.add(core);

  /* ================= bloklar ================= */
  const bandEdges = [-69, -46, -23, 0, 23, 46, 69].map((d) => d * D2R);
  const counts = [7, 11, 12, 12, 11, 7];
  type Inst = {
    mesh: THREE.InstancedMesh;
    i: number;
    q: THREE.Quaternion;
    C: THREE.Vector3; // boylam 0'daki merkez
    W: THREE.Vector3; // dünya merkezi
    n: THREE.Vector3;
    axis: THREE.Vector3;
    delay: number;
    amp: number;
    color: string;
    gap: number; // -1 değilse boşluk sırası
  };
  const insts: Inst[] = [];
  const GAP_BAND = 5;
  const GAP_UNITS = [6, 0, 1];
  const gapInfo: { lon: number; color: string; inst?: Inst }[] = [];
  let tileGeoTop: THREE.BufferGeometry | null = null;
  let lastColor = -1;
  for (let b = 0; b < 6; b++) {
    const lat0 = bandEdges[b];
    const dLat = bandEdges[b + 1] - lat0;
    const latC = lat0 + dLat / 2;
    const n = counts[b];
    const dLon = TAU / n;
    const off = (b % 2) * 0.5;
    const units: { k: number; span: number }[] = [];
    for (let k = 0; k < n;) {
      const isGap = b === GAP_BAND && GAP_UNITS.includes(k);
      const nextGap = b === GAP_BAND && GAP_UNITS.includes(k + 1);
      const span = !isGap && !nextGap && k < n - 1 && rnd() < 0.3 ? 2 : 1;
      units.push({ k, span });
      k += span;
    }
    const C = V(0, Math.sin(latC), Math.cos(latC)).multiplyScalar(RM);
    for (const span of [1, 2]) {
      const list = units.filter((u) => u.span === span);
      if (!list.length) continue;
      const geo = tileGeo(latC, dLat, dLon * span);
      if (b === GAP_BAND && span === 1) tileGeoTop = geo;
      const mesh = new THREE.InstancedMesh(geo, tileMat, list.length);
      group.add(mesh);
      list.forEach((u, i) => {
        const lon = (u.k + off + span / 2) * dLon;
        let ci = Math.floor(rnd() * COLS.length);
        if (ci === lastColor) ci = (ci + 3) % COLS.length;
        lastColor = ci;
        const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), lon);
        const W = C.clone().applyQuaternion(q);
        const inst: Inst = {
          mesh,
          i,
          q,
          C,
          W,
          n: W.clone().normalize(),
          axis: V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
          delay: (5 - b) * 0.035 + rnd() * 0.06,
          amp: 0.22 + rnd() * 0.16,
          color: COLS[ci],
          gap: -1,
        };
        mesh.setColorAt(i, new THREE.Color(COLS[ci]));
        if (b === GAP_BAND && GAP_UNITS.includes(u.k)) {
          inst.gap = GAP_UNITS.indexOf(u.k);
          gapInfo[inst.gap] = { lon: lon > Math.PI ? lon - TAU : lon, color: COLS[ci], inst };
        }
        insts.push(inst);
      });
    }
  }

  // kutup kapakları (yuvarlak kenarlı kubbe)
  const caps: THREE.Group[] = [];
  for (const sy of [1, -1]) {
    const g = new THREE.Group();
    const lat = CAP + 0.018;
    const rr = RM * Math.cos(lat);
    const yy = RM * Math.sin(lat);
    const dome = new THREE.SphereGeometry(RM + TH / 2, 32, 6, 0, TAU, 0, Math.PI / 2 - lat);
    const rim = new THREE.TorusGeometry(rr, TH / 2, 8, 40).rotateX(Math.PI / 2).translate(0, yy, 0);
    const col = sy > 0 ? PAL.butter : PAL.lilac;
    const parts = [paint(dome, col), paint(rim, col, 0.98)];
    if (sy > 0) {
      // kapak üstünde zemin işareti: sarı-siyah yuvarlak bant
      parts.push(
        paint(
          new THREE.TorusGeometry(0.2, 0.012, 4, 32).rotateX(Math.PI / 2).translate(0, RM + TH / 2 - 0.012, 0),
          PAL.ink,
        ),
      );
    }
    const geo = merge(parts);
    if (sy < 0) geo.rotateX(Math.PI);
    g.add(new THREE.Mesh(geo, vm));
    group.add(g);
    caps.push(g);
  }
  const capN = caps[0];

  /* ================= vinç ================= */
  const crane = new THREE.Group();
  crane.position.y = RM + TH / 2 - 0.01;
  capN.add(crane);
  {
    const parts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      parts.push(paint(place(rbox(0.085, 0.07, 0.32, 0.03), V(sx * 0.1, 0.035, 0)), '#5E5878'));
      for (let k = 0; k < 4; k++) {
        parts.push(
          paint(
            new THREE.CylinderGeometry(0.026, 0.026, 0.09, 10)
              .rotateZ(Math.PI / 2)
              .translate(sx * 0.1, 0.035, -0.12 + k * 0.08),
            PAL.steel,
          ),
        );
      }
    }
    parts.push(paint(place(rbox(0.16, 0.04, 0.2, 0.015), V(0, 0.07, 0)), '#6E688A'));
    crane.add(new THREE.Mesh(merge(parts), vm));
  }
  const turret = new THREE.Group();
  turret.position.y = 0.09;
  crane.add(turret);
  const BOOM_A = 38 * D2R;
  const BOOM_L = 0.57;
  const PIV = V(0, 0.15, 0.06);
  const tipLocal = V(0, PIV.y + BOOM_L * Math.sin(BOOM_A), PIV.z + BOOM_L * Math.cos(BOOM_A));
  {
    const parts: THREE.BufferGeometry[] = [];
    parts.push(paint(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 20).translate(0, 0.012, 0), PAL.steel));
    parts.push(paint(place(rbox(0.2, 0.15, 0.18, 0.035), V(0, 0.1, -0.02)), PAL.butter));
    parts.push(paint(place(rbox(0.21, 0.025, 0.19, 0.012), V(0, 0.18, -0.02)), PAL.coral));
    parts.push(paint(place(rbox(0.14, 0.07, 0.012, 0.005), V(0, 0.12, 0.071)), '#CFF1FF', 1.15));
    parts.push(paint(place(rbox(0.012, 0.06, 0.1, 0.004), V(0.101, 0.12, 0.0)), '#CFF1FF', 1.15));
    parts.push(paint(place(rbox(0.19, 0.09, 0.08, 0.03), V(0, 0.08, -0.15)), PAL.periwinkle));
    for (const y of [0.06, 0.1]) parts.push(paint(place(rbox(0.195, 0.012, 0.082, 0.005), V(0, y, -0.15)), '#9AA6F7'));
    // bayrak
    parts.push(paint(seg(V(-0.07, 0.19, -0.08), V(-0.07, 0.31, -0.08), 0.006), PAL.steel));
    const fl = new THREE.Shape();
    fl.moveTo(0, 0);
    fl.lineTo(0.07, -0.02);
    fl.lineTo(0, -0.045);
    parts.push(paint(new THREE.ShapeGeometry(fl).translate(-0.07, 0.31, -0.08), PAL.coral));
    parts.push(paint(new THREE.ShapeGeometry(fl).rotateY(Math.PI).translate(-0.07, 0.31, -0.081), PAL.coral));
    // kafes bom
    const bm = new THREE.Matrix4().compose(PIV, Q(-BOOM_A, 0, 0), V(1, 1, 1));
    const boom: THREE.BufferGeometry[] = [];
    const rails = [V(-0.03, 0, 0), V(0.03, 0, 0), V(0, 0.045, 0)];
    for (const r of rails) boom.push(seg(r, r.clone().add(V(0, r.y > 0 ? -0.03 : 0, BOOM_L)), 0.011));
    const S = 8;
    for (let i = 0; i < S; i++) {
      const z0 = (i / S) * BOOM_L;
      const z1 = ((i + 1) / S) * BOOM_L;
      const shrink = (z: number) => 1 - (z / BOOM_L) * 0.45;
      const a = rails[i % 2];
      const top0 = V(0, 0.045 * shrink(z0), z0);
      boom.push(seg(V(a.x * shrink(z0), 0, z0), V(-a.x * shrink(z1), 0, z1), 0.006, 4));
      boom.push(seg(V(a.x * shrink(z0), 0, z0), top0.clone().setZ(z1), 0.006, 4));
    }
    boom.push(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12).rotateZ(Math.PI / 2).translate(0, 0, BOOM_L));
    for (const g of boom) parts.push(paint(g.applyMatrix4(bm), PAL.apricot));
    parts.push(paint(new THREE.SphereGeometry(0.035, 10, 8).translate(PIV.x, PIV.y, PIV.z), PAL.steel));
    // bom kaldırma halatı
    parts.push(paint(seg(V(0, 0.18, -0.1), tipLocal.clone().add(V(0, 0.02, 0)), 0.004, 4), PAL.ink));
    turret.add(new THREE.Mesh(merge(parts), vm));
  }
  const beaconMat = glow('#FFB347', 0.9);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), beaconMat);
  beacon.position.set(0.07, 0.205, -0.08);
  turret.add(beacon);
  const windowGlowMat = glow('#BFE8FF', 0);
  const windowGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), windowGlowMat);
  windowGlow.position.set(0, 0.12, 0.08);
  turret.add(windowGlow);

  // kanca + halat (grup uzayında)
  const hook = new THREE.Group();
  {
    const parts = [
      paint(place(rbox(0.06, 0.045, 0.05, 0.012), V(0, 0.02, 0)), PAL.coral),
      paint(
        new THREE.TorusGeometry(0.018, 0.006, 6, 14, Math.PI * 1.4).rotateZ(-0.4 * Math.PI).translate(0, -0.015, 0),
        PAL.steel,
      ),
    ];
    hook.add(new THREE.Mesh(merge(parts), vm));
  }
  group.add(hook);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1, 5).translate(0, 0.5, 0), clay(PAL.ink));
  group.add(cable);

  /* ================= holografik yazıcı (iskele platformu) ================= */
  const PAD_LON = -105 * D2R;
  const REACH = tipLocal.z;
  const padPos = V(Math.sin(PAD_LON) * REACH, 0.98, Math.cos(PAD_LON) * REACH);
  const latTop = bandEdges[GAP_BAND] + (bandEdges[6] - bandEdges[5]) / 2;
  const dLatTop = bandEdges[6] - bandEdges[5];
  const dLonTop = TAU / counts[GAP_BAND];
  const Ctop = V(0, Math.sin(latTop), Math.cos(latTop)).multiplyScalar(RM);
  const Rnu = new THREE.Quaternion().setFromUnitVectors(Ctop.clone().normalize(), V(0, 1, 0));
  const carriedGeo = tileGeo(latTop, dLatTop, dLonTop, true).translate(-Ctop.x, -Ctop.y, -Ctop.z);
  const carriedMat = (clay(PAL.white) as THREE.MeshStandardMaterial).clone();
  const carried = new THREE.Mesh(carriedGeo, carriedMat);
  group.add(carried);
  const printWire = new THREE.LineSegments(
    tileOutline(latTop, dLatTop, dLonTop).translate(-Ctop.x, -Ctop.y, -Ctop.z),
    new THREE.LineBasicMaterial({ color: '#7FD3FF', transparent: true, opacity: 0.9 }),
  );
  printWire.quaternion.setFromAxisAngle(V(0, 1, 0), PAD_LON).multiply(Rnu);
  printWire.position.copy(padPos).add(V(0, 0.11, 0));
  group.add(printWire);
  const padTex = canvasTexture(128, 128, (x, w, h) => {
    x.fillStyle = 'rgba(90,170,245,0.75)';
    x.beginPath();
    x.roundRect(4, 4, w - 8, h - 8, 16);
    x.fill();
    x.strokeStyle = 'rgba(230,250,255,0.95)';
    x.lineWidth = 5;
    x.stroke();
    x.lineWidth = 2;
    for (let i = 24; i < w - 10; i += 20) {
      x.beginPath();
      x.moveTo(i, 10);
      x.lineTo(i, h - 10);
      x.moveTo(10, i);
      x.lineTo(w - 10, i);
      x.stroke();
    }
  });
  const padMat = new THREE.MeshBasicMaterial({
    map: padTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36).rotateX(-Math.PI / 2), padMat);
  pad.position.copy(padPos).add(V(0, 0.012, 0));
  pad.rotation.y = PAD_LON;
  group.add(pad);
  const laserMat = glow('#9FE6FF', 0);
  laserMat.side = THREE.DoubleSide;
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.24).rotateX(-Math.PI / 2), laserMat);
  laser.rotation.y = PAD_LON;
  group.add(laser);

  // gap tel çerçeveleri
  const outlineGeo = tileOutline(latTop, dLatTop, dLonTop);
  const outlineMat = new THREE.LineBasicMaterial({ color: '#5CC8FF', transparent: true, opacity: 0.9 });
  const outlines = gapInfo.map((gi) => {
    const l = new THREE.LineSegments(outlineGeo, outlineMat);
    l.rotation.y = gi.lon;
    group.add(l);
    return l;
  });

  /* ================= iskele (statik) + platform ayakları ================= */
  {
    const parts: THREE.BufferGeometry[] = [];
    // platform ayakları
    const { E: pE } = frame(0, PAD_LON);
    const fwd = V(Math.sin(PAD_LON), 0, Math.cos(PAD_LON));
    for (const a of [-1, 1]) {
      for (const b of [-1, 1]) {
        const top = padPos
          .clone()
          .addScaledVector(pE, a * 0.15)
          .addScaledVector(fwd, b * 0.15);
        const rh = Math.hypot(top.x, top.z);
        const yb = Math.sqrt(Math.max(0, (RM + TH / 2) ** 2 - rh * rh)) - 0.04;
        parts.push(paint(seg(top, V(top.x, yb, top.z), 0.012), PAL.steel));
      }
    }
    parts.push(
      paint(place(rbox(0.38, 0.025, 0.38, 0.01), padPos.clone().add(V(0, -0.01, 0)), Q(0, PAD_LON, 0)), '#8A90A8'),
    );
    // ana iskele: ön sağda, ekvatorun altında, gezegene teğet
    const lat0 = -12 * D2R;
    const lon0 = 38 * D2R;
    const { E, N, U } = frame(lat0, lon0);
    const O = U.clone().multiplyScalar(1.2);
    const P = (e: number, n: number, u = 0) =>
      O.clone().addScaledVector(E, e).addScaledVector(N, n).addScaledVector(U, u);
    const poles = [-0.24, 0, 0.24];
    for (const e of poles) {
      for (const u of [0, -0.13]) parts.push(paint(seg(P(e, -0.48, u), P(e, 0.42, u), 0.014), PAL.steel));
    }
    for (const n of [-0.4, -0.08, 0.26]) {
      for (const u of [0, -0.13]) parts.push(paint(seg(P(-0.25, n, u), P(0.25, n, u), 0.01), PAL.steel));
      for (const e of poles) parts.push(paint(seg(P(e, n, 0), P(e, n, -0.13), 0.009), PAL.steel));
    }
    // çaprazlar
    parts.push(paint(seg(P(-0.24, -0.4, 0), P(0, -0.08, 0), 0.008), '#AEB4C2'));
    parts.push(paint(seg(P(0, -0.08, 0), P(0.24, 0.26, 0), 0.008), '#AEB4C2'));
    parts.push(paint(seg(P(0.24, -0.4, 0), P(0, -0.08, 0), 0.008), '#AEB4C2'));
    // kalaslar
    const qd = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(E, U, N.clone().negate()));
    for (const n of [-0.08, 0.26]) {
      for (const k of [0, 1]) {
        parts.push(
          paint(
            place(rbox(0.5, 0.022, 0.06, 0.008), P(0, n + 0.02, -0.035 - k * 0.065), qd),
            k ? '#D9925E' : PAL.apricot,
          ),
        );
      }
    }
    // merdiven
    for (const e of [0.06, 0.16]) parts.push(paint(seg(P(e, -0.4, 0.03), P(e, -0.08, 0.03), 0.008), PAL.cocoa));
    for (let i = 0; i < 5; i++) {
      const n = -0.36 + i * 0.065;
      parts.push(paint(seg(P(0.06, n, 0.03), P(0.16, n, 0.03), 0.006), PAL.cocoa));
    }
    // duvara bağlantı
    for (const n of [-0.4, 0.26]) parts.push(paint(seg(P(0, n, -0.13), P(0, n, -0.27), 0.009), PAL.steel));
    // trafik konisi + boya kovası + tuğla yığını
    const cone = (pp: THREE.Vector3) => {
      parts.push(
        paint(place(new THREE.ConeGeometry(0.035, 0.09, 12), pp.clone().addScaledVector(N, 0.045), qd), PAL.apricot),
      );
      parts.push(
        paint(
          place(new THREE.CylinderGeometry(0.021, 0.026, 0.018, 12), pp.clone().addScaledVector(N, 0.045), qd),
          PAL.white,
        ),
      );
      parts.push(paint(place(rbox(0.08, 0.012, 0.08, 0.004), pp.clone().addScaledVector(N, 0.006), qd), PAL.apricot));
    };
    cone(P(-0.16, 0.3, -0.06));
    cone(P(0.14, -0.04, -0.06));
    parts.push(paint(place(new THREE.CylinderGeometry(0.03, 0.025, 0.06, 12), P(0.17, 0.32, -0.06), qd), PAL.sky));
    parts.push(paint(place(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 12), P(0.17, 0.351, -0.06), qd), '#F7F2E8'));
    for (let i = 0; i < 3; i++) {
      parts.push(
        paint(
          place(
            rbox(0.07, 0.035, 0.045, 0.01),
            P(-0.1 + (i % 2) * 0.075 - (i === 2 ? 0.035 : 0), -0.04 + (i === 2 ? 0.036 : 0), -0.07),
            qd,
          ),
          COLS[(i * 3) % 9],
        ),
      );
    }
    group.add(new THREE.Mesh(merge(parts), vm));
  }

  /* ================= plan panelleri ================= */
  const texs = [blueprint(0), blueprint(1), blueprint(2)];
  const panelMats = texs.map(
    (t) =>
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
  );
  const panelRoot = new THREE.Group();
  group.add(panelRoot);
  const panelGeo = new THREE.PlaneGeometry(0.6, 0.45);
  const panelDefs = [
    { a: -0.9, y: 0.25, k: 0, tilt: 0.12 },
    { a: 0.75, y: 0.55, k: 1, tilt: -0.1 },
    { a: 2.1, y: -0.2, k: 2, tilt: 0.08 },
    { a: 3.3, y: 0.45, k: 0, tilt: -0.12 },
    { a: 4.4, y: -0.55, k: 1, tilt: 0.1 },
  ];
  const panels = panelDefs.map((d) => {
    const m = new THREE.Mesh(panelGeo, panelMats[d.k]);
    m.renderOrder = 2;
    panelRoot.add(m);
    return m;
  });

  // yörüngede minik blok kümeleri
  const clusters: THREE.Group[] = [];
  for (let c = 0; c < 2; c++) {
    const g = new THREE.Group();
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 3; i++) {
      parts.push(
        paint(
          place(rbox(0.1, 0.06, 0.07, 0.022), V((i - 1) * 0.06, i === 1 ? 0.055 : 0, (i % 2) * 0.02), Q(0, i * 0.3, 0)),
          COLS[(c * 4 + i * 2) % 9],
        ),
      );
    }
    g.add(new THREE.Mesh(merge(parts), vm));
    group.add(g);
    clusters.push(g);
  }

  // yerine oturma tozu
  const dust = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), clay(PAL.cream), 8);
  dust.frustumCulled = false;
  group.add(dust);

  /* ================= durum ================= */
  const pk = new OneShot(2.6);
  let ct = 0; // döngü saati
  let cyc = 0; // hangi boşluk
  let loops = 0;
  let hoverS = 0;
  let prevTheta = PAD_LON;
  let swing = 0;
  const CYCLE = 6.4;

  const mq = new THREE.Quaternion();
  const mq2 = new THREE.Quaternion();
  const mp = V();
  const ms = V(1, 1, 1);
  const mm = new THREE.Matrix4();
  const tip = V();
  const hookPos = V();
  const tmp = V();
  const tmp2 = V();
  const Yax = V(0, 1, 0);
  const qHang = new THREE.Quaternion();
  const qFinal = new THREE.Quaternion();
  const qY = new THREE.Quaternion();
  const gapScale = [0, 0, 0];
  const dustDir = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * TAU;
    return V(Math.cos(a), 0.3 + (i % 3) * 0.15, Math.sin(a));
  });
  const dustOrigin = V();

  function update(s: CharacterState) {
    const dt = s.dt;
    const t = s.t;
    hoverS = damp(hoverS, s.hover, 6, dt);
    const hv = hoverS;
    const red = s.reduce;
    const p = pk.tick(dt);

    group.rotation.y = Math.sin(t * 0.25) * (red ? 0.03 : 0.12);
    group.position.y = Math.sin(t * 0.9) * 0.025;

    /* ---- vinç döngüsü ---- */
    const speed = red ? 0.4 : 1 + hv * 0.8;
    ct += dt * speed;
    if (ct >= CYCLE) {
      ct -= CYCLE;
      cyc = (cyc + 1) % 3;
      if (cyc === 0) loops++;
    }
    const tau = ct;
    const gi = gapInfo[cyc];
    const prevLon = cyc === 0 ? (loops === 0 ? PAD_LON : gapInfo[2].lon) : gapInfo[cyc - 1].lon;
    let theta: number;
    if (tau < 1.1) theta = lerp(prevLon, PAD_LON, ease.inOut(tau / 1.1));
    else if (tau < 2.5) theta = PAD_LON;
    else if (tau < 3.9) theta = lerp(PAD_LON, gi.lon, ease.inOut((tau - 2.5) / 1.4));
    else theta = gi.lon;
    turret.rotation.y = theta;
    const vel = (theta - prevTheta) / Math.max(dt, 1e-4);
    prevTheta = theta;
    swing = damp(swing, -vel * 0.12, 4, dt);

    // uç noktası
    tip.set(Math.sin(theta) * tipLocal.z, tipLocal.y, Math.cos(theta) * tipLocal.z);
    tip.add(crane.position).add(capN.position);

    const HOOK_OFF = 0.1; // kanca üstü ile blok merkezi arası
    const padCenterY = padPos.y + 0.11;
    const clIdle = 0.2;
    const clPad = tip.y - (padCenterY + HOOK_OFF + 0.045);
    const finalW = gi.inst!.W;
    const clFinal = tip.y - (finalW.y + 0.1 + HOOK_OFF + 0.045);
    let cl = clIdle;
    if (tau < 1.1) cl = clIdle;
    else if (tau < 1.7) cl = lerp(clIdle, clPad, ease.inOut((tau - 1.1) / 0.6));
    else if (tau < 1.9) cl = clPad;
    else if (tau < 2.5) cl = lerp(clPad, clPad - 0.2, ease.inOut((tau - 1.9) / 0.6));
    else if (tau < 3.9) cl = clPad - 0.2;
    else if (tau < 4.7) cl = lerp(clPad - 0.2, clFinal, ease.inOut((tau - 3.9) / 0.8));
    else if (tau < 5.0) cl = clFinal;
    else if (tau < 5.7) cl = lerp(clFinal + 0.1, clIdle, ease.inOut((tau - 5.0) / 0.7));
    hookPos.copy(tip);
    hookPos.y -= cl + 0.045;

    // taşınan blok
    qY.setFromAxisAngle(Yax, theta);
    qHang.copy(qY).multiply(Rnu);
    carriedMat.color.set(gi.color);
    carried.visible = tau < 5.0;
    printWire.visible = false;
    laser.visible = false;
    if (tau < 1.8) {
      // yazıcıda: önce basılır
      qY.setFromAxisAngle(Yax, PAD_LON);
      carried.quaternion.copy(qY).multiply(Rnu);
      const pr = clamp01(tau / 1.1);
      carried.position.copy(padPos);
      carried.position.y += 0.03 + 0.08 * pr;
      carried.scale.set(1, Math.max(0.02, ease.out(pr)), 1);
      if (pr < 1) {
        printWire.visible = true;
        (printWire.material as THREE.LineBasicMaterial).opacity = 0.9 * (1 - pr * 0.6);
        laser.visible = true;
        laser.position.copy(padPos);
        laser.position.y += 0.03 + 0.16 * pr;
        laserMat.opacity = 0.35 * Math.sin(pr * Math.PI) + 0.1;
      }
    } else if (tau < 4.7) {
      carried.scale.set(1, 1, 1);
      carried.position.copy(hookPos);
      carried.position.y -= HOOK_OFF;
      tmp.set(Math.cos(theta), 0, -Math.sin(theta));
      mq2.setFromAxisAngle(tmp, swing + Math.sin(t * 3) * 0.03);
      carried.quaternion.copy(mq2).multiply(qHang);
    } else if (tau < 5.0) {
      const k = ease.inOut((tau - 4.7) / 0.3);
      qFinal.copy(gi.inst!.q);
      carried.quaternion.copy(qHang).slerp(qFinal, k);
      tmp.copy(hookPos);
      tmp.y -= HOOK_OFF;
      carried.position.lerpVectors(tmp, finalW, k);
      carried.scale.set(1, 1, 1);
      hookPos.copy(carried.position);
      hookPos.y += HOOK_OFF;
    }
    hook.position.copy(hookPos);
    hook.rotation.y = theta;
    // halat: uçtan kancaya
    tmp.copy(tip).sub(hookPos);
    const len = tmp.length();
    cable.position.copy(hookPos);
    cable.position.y += 0.045;
    cable.quaternion.setFromUnitVectors(Yax, tmp.normalize());
    cable.scale.set(1, Math.max(0.01, len - 0.045), 1);

    // boşluk ölçekleri
    for (let k = 0; k < 3; k++) {
      let sc: number;
      if (k < cyc) sc = 1;
      else if (k > cyc) sc = 0;
      else sc = tau >= 5.0 ? 1 + Math.sin((tau - 5) * 18) * Math.exp(-(tau - 5) * 6) * 0.12 : 0;
      if (cyc === 0 && loops > 0 && tau < 1.2) sc = Math.max(sc, 1 - smooth(0, 1.2, tau));
      gapScale[k] = sc;
      outlines[k].visible = sc < 0.6;
      outlines[k].scale.setScalar(1 + (k === cyc ? Math.sin(t * 5) * 0.015 : 0));
    }
    outlineMat.opacity = 0.55 + 0.35 * Math.sin(t * 4) * 0.5 + 0.2 * s.night;

    // toz
    const dp = tau >= 5.0 ? clamp01((tau - 5.0) / 0.8) : -1;
    dust.visible = dp >= 0 && dp < 1;
    if (dust.visible) {
      dustOrigin.copy(finalW).multiplyScalar(1.08);
      for (let i = 0; i < 8; i++) {
        tmp2.copy(dustDir[i]).multiplyScalar(0.05 + ease.out(dp) * 0.18);
        mp.copy(dustOrigin).add(tmp2);
        ms.setScalar(Math.max(0.001, 0.028 * Math.sin(dp * Math.PI) * (1 + (i % 2) * 0.4)));
        mq.identity();
        mm.compose(mp, mq, ms);
        dust.setMatrixAt(i, mm);
      }
      dust.instanceMatrix.needsUpdate = true;
    }

    /* ---- bloklar: poke patlaması + boşluklar ---- */
    for (const it of insts) {
      let sc = 1;
      if (it.gap >= 0) sc = gapScale[it.gap];
      let off = 0;
      let rot = 0;
      if (p >= 0) {
        const lp = clamp01((p - it.delay) / 0.8);
        off = lp < 0.25 ? ease.out(lp / 0.25) : 1 - ease.outElastic((lp - 0.25) / 0.75);
        off *= it.amp;
        rot = off * 0.9;
      }
      mq2.setFromAxisAngle(it.axis, rot);
      mq.copy(it.q).multiply(mq2);
      tmp.copy(it.C).applyQuaternion(mq).multiplyScalar(sc);
      mp.copy(it.W).addScaledVector(it.n, off).sub(tmp);
      ms.setScalar(Math.max(0.0001, sc));
      mm.compose(mp, mq, ms);
      it.mesh.setMatrixAt(it.i, mm);
    }
    for (const it of insts) it.mesh.instanceMatrix.needsUpdate = true;
    const capOff =
      p >= 0
        ? (() => {
            const lp = clamp01((p - 0.02) / 0.8);
            return (lp < 0.25 ? ease.out(lp / 0.25) : 1 - ease.outElastic((lp - 0.25) / 0.75)) * 0.3;
          })()
        : 0;
    capN.position.y = capOff;
    caps[1].position.y = -capOff * 0.8;
    crane.rotation.z = capOff * 0.4 * Math.sin(t * 20);

    /* ---- vinç ışıkları ---- */
    const blinkRate = 2.2 + hv * 3;
    beaconMat.opacity = (Math.sin(t * blinkRate * TAU) > 0.2 ? 1 : 0.15) * (0.7 + s.night * 0.3);
    windowGlowMat.opacity = 0.12 + s.night * 0.4;

    /* ---- plan panelleri ---- */
    const flash = p >= 0 ? hill(p, 0.0, 0.5) : 0;
    panelRoot.rotation.y += dt * (red ? 0.02 : 0.07 + hv * 0.15 + flash * 1.2);
    panelDefs.forEach((d, i) => {
      const m = panels[i];
      const a = d.a;
      const r = 1.55 + Math.sin(t * 0.7 + i) * 0.03;
      m.position.set(Math.sin(a) * r, d.y + Math.sin(t * (0.8 + i * 0.13) + i * 2) * 0.05, Math.cos(a) * r);
      m.rotation.set(d.tilt, a, Math.sin(t * 0.6 + i) * 0.05);
      m.scale.setScalar(1 + flash * 0.18 + hv * 0.06);
    });
    for (const m of panelMats) m.opacity = Math.min(1, 0.7 + s.night * 0.15 + hv * 0.12 + flash * 0.3);
    for (const m of panelMats) m.color.setScalar(1 + flash * 0.6);
    padMat.opacity = 0.8 + flash * 0.2;

    /* ---- minik blok kümeleri ---- */
    clusters.forEach((g, i) => {
      const a = t * (red ? 0.05 : 0.18 + hv * 0.2) + i * Math.PI + 0.6;
      g.position.set(Math.sin(a) * 1.72, (i ? -0.45 : 0.15) + Math.sin(t * 0.9 + i) * 0.06, Math.cos(a) * 1.72);
      g.rotation.set(t * 0.4 + i, t * 0.6, t * 0.3 * (i ? -1 : 1));
      const kick = p >= 0 ? hill(p, 0.05, 0.6) * 0.4 : 0;
      g.scale.setScalar(1 + kick);
    });
  }

  update({ dt: 0.016, t: 0, hover: 0, night: 0, reduce: false, camera: new THREE.PerspectiveCamera() });
  return { group, update, poke: () => pk.start() };
}
