import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, clay, clayBump, damp, ease, OneShot, PAL, rbox, smooth, tube, type Character } from './kit';

/**
 * Gelişim alanım: üst üste dizilmiş kitaplardan bir gezegen; tepesinden bir bilgi ağacı büyür.
 * Kökleri renkli kablolar (uçları kitaplara takılı fişler, içlerinden ağaca ışık akar),
 * yaprakları minik parlayan yıldızlar, yanında kavisli bir merdiven ve tırmanan minik bir öğrenci.
 * Dürtünce: ağaç yeni bir çiçekli dal sürer, kitaplar karışıp yerine oturur, yapraklar kıvılcım saçar.
 */

// ---------- yerel yardımcılar ----------
const _m = new THREE.Matrix4();
const _q2 = new THREE.Quaternion();
const ZA = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
function M(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}
let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const rr = (a: number, b: number) => a + (b - a) * rnd();

const vmats = new Map<string, THREE.MeshStandardMaterial>();
/** Köşe renkli kil (birçok renkli statik parçayı tek çizimde birleştirmek için). */
function vclay(side: THREE.Side = THREE.FrontSide) {
  const k = String(side);
  let m = vmats.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      bumpMap: clayBump(),
      bumpScale: 0.6,
      side,
    });
    vmats.set(k, m);
  }
  return m;
}
class Batch {
  parts: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, m?: THREE.Matrix4) {
    const x = g.index ? g.toNonIndexed() : g.clone();
    if (m) x.applyMatrix4(m);
    if (!x.getAttribute('normal')) x.computeVertexNormals();
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', x.getAttribute('position'));
    out.setAttribute('normal', x.getAttribute('normal'));
    const n = x.getAttribute('position').count;
    out.setAttribute('uv', x.getAttribute('uv') ?? new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const c = new THREE.Color(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.parts.push(out);
    return this;
  }
  geometry() {
    return mergeGeometries(this.parts, false)!;
  }
  mesh() {
    return new THREE.Mesh(this.geometry(), vclay());
  }
}
function starShape(ro: number, ri: number, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / n;
    const r = i % 2 ? ri : ro;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}

// ---------- ölçüler ----------
const C = new THREE.Vector3(0, -0.42, 0); // kitap küresinin merkezi
const R = 0.86;
const SC = 0.88; // genel ölçek (ağaç tepesi dahil sığsın)
const TOP = C.y + R; // ~0.44
const BASE = new THREE.Vector3(0, TOP + 0.05, 0); // ağacın dibi
const sph = (th: number, ph: number, r: number, out: THREE.Vector3) =>
  out.set(C.x + r * Math.sin(th) * Math.cos(ph), C.y + r * Math.cos(th), C.z + r * Math.sin(th) * Math.sin(ph));

const BOOK_COLS = [
  PAL.periwinkle,
  PAL.coral,
  PAL.mint,
  PAL.butter,
  PAL.lilac,
  PAL.sky,
  '#E85D6F',
  '#5C8FD6',
  '#6DBE7A',
  PAL.apricot,
  PAL.pink,
];

interface Book {
  layer: number;
  ph: number; // açı
  cr: number; // merkez yarıçapı
  y: number;
  L: number;
  th: number;
  w: number;
  yaw: number;
  fore: boolean; // sayfa kenarı dışarı bakıyor
  color: string;
  cover: number[]; // örnek indeksleri
  page: number;
  deco: number[];
  out: number; // dış yarıçap
}

export default function create(): Character {
  seed = 7;
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  root.position.y = -0.24;
  root.scale.setScalar(SC);

  // ---------- çekirdek ----------
  const sb = new Batch();
  sb.add(new THREE.SphereGeometry(R - 0.12, 16, 10), '#6b4a3f', M(C.x, C.y, C.z));

  // ---------- kitap katmanları ----------
  const books: Book[] = [];
  const layers: { y: number; th: number }[] = [];
  {
    let y = C.y - R + 0.1;
    while (y < TOP - 0.22) {
      const th = rr(0.13, 0.19);
      layers.push({ y: y + th / 2, th });
      y += th + 0.004;
    }
  }
  let nCover = 0;
  let nBox = 0;
  let nPage = 0;
  let nDeco = 0;
  layers.forEach((ly, li) => {
    const dy = Math.max(Math.abs(ly.y - C.y) + ly.th * 0.25, 0);
    const r = Math.sqrt(Math.max(0.02, R * R - dy * dy));
    const n = Math.max(4, Math.round((Math.PI * 2 * r) / 0.36));
    const off = rnd() * Math.PI * 2;
    for (let j = 0; j < n; j++) {
      const ph = off + (j / n) * Math.PI * 2 + rr(-0.06, 0.06);
      const out = r + rr(-0.01, 0.045);
      const inner = Math.max(0.05, out - 0.5);
      const fore = rnd() < 0.4;
      const b: Book = {
        layer: li,
        ph,
        cr: (out + inner) / 2,
        y: ly.y + rr(-0.006, 0.006),
        L: out - inner,
        th: ly.th * rr(0.86, 0.97),
        w: ((Math.PI * 2 * r) / n) * rr(0.8, 0.95),
        yaw: rr(-0.12, 0.12),
        fore,
        color: BOOK_COLS[Math.floor(rnd() * BOOK_COLS.length)],
        cover: [],
        page: -1,
        deco: [],
        out,
      };
      if (fore) {
        b.cover.push(nBox++, nBox++, nBox++);
        b.page = nPage++;
      } else {
        b.cover.push(nCover++);
        b.deco.push(nDeco++, nDeco++);
        if (rnd() < 0.5) b.deco.push(nDeco++);
      }
      books.push(b);
    }
  });
  // tepe yığını: üst üste yatan kitaplar (ağacın zemini)
  const capBooks: { x: number; y: number; z: number; ry: number; w: number; h: number; d: number; c: string }[] = [
    { x: 0.02, y: TOP - 0.17, z: 0.0, ry: 0.3, w: 0.78, h: 0.11, d: 0.56, c: PAL.periwinkle },
    { x: -0.04, y: TOP - 0.065, z: 0.02, ry: -0.35, w: 0.6, h: 0.1, d: 0.44, c: PAL.coral },
    { x: 0.01, y: TOP + 0.025, z: -0.01, ry: 0.15, w: 0.44, h: 0.08, d: 0.34, c: PAL.mint },
  ];
  for (const cb of capBooks) {
    sb.add(rbox(cb.w, cb.h, cb.d, 0.025, 2), cb.c, M(cb.x, cb.y, cb.z, 0, cb.ry, 0));
    sb.add(
      new THREE.BoxGeometry(cb.w - 0.05, cb.h * 0.72, cb.d - 0.02),
      '#FFF6E6',
      M(cb.x + Math.sin(cb.ry) * 0.035, cb.y, cb.z + Math.cos(cb.ry) * 0.035, 0, cb.ry, 0),
    );
  }

  const coverGeo = rbox(1, 1, 1, 0.09, 1);
  const covers = new THREE.InstancedMesh(coverGeo, clay(PAL.white), nCover);
  const pageTex = canvasTexture(32, 64, (x, w, h) => {
    x.fillStyle = '#FFF6E6';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(170,135,110,0.45)';
    for (let i = 3; i < h; i += 7) x.fillRect(0, i, w, 2);
  });
  const pages = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.9 }),
    nPage,
  );
  const decos = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clay(PAL.white, { rough: 0.6 }), nDeco);
  const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clay(PAL.white), nBox);
  root.add(covers, boxes, pages, decos);
  const _c = new THREE.Color();
  for (const b of books) {
    _c.set(b.color);
    for (const i of b.cover) (b.fore ? boxes : covers).setColorAt(i, _c);
    const dc = b.color === PAL.butter ? PAL.cocoa : rnd() < 0.6 ? PAL.butter : PAL.cream;
    b.deco.forEach((i, k) => decos.setColorAt(i, _c.set(k === 2 ? PAL.cream : dc)));
  }
  const layerRot = new Float32Array(layers.length);
  const layerPush = new Float32Array(layers.length);
  const bookM = new THREE.Matrix4();
  const partM = new THREE.Matrix4();
  function bookMatrix(b: Book, out: THREE.Matrix4) {
    const ph = b.ph + layerRot[b.layer];
    const cr = b.cr + layerPush[b.layer] * (0.6 + 0.4 * Math.sin(b.ph * 3));
    _q.setFromEuler(_e.set(0, -ph + b.yaw, 0));
    return out.compose(_v.set(Math.cos(ph) * cr, b.y, Math.sin(ph) * cr), _q, _s.set(1, 1, 1));
  }
  function part(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    return partM.compose(_v.set(x, y, z), _q.identity(), _s.set(sx, sy, sz));
  }
  function writeBooks() {
    for (const b of books) {
      bookMatrix(b, bookM);
      const h = b.L / 2;
      if (b.fore) {
        boxes.setMatrixAt(
          b.cover[0],
          _m.multiplyMatrices(bookM, part(-0.04, 0, 0, b.L - 0.08, b.th * 0.8, b.w * 0.96)),
        );
        boxes.setMatrixAt(b.cover[1], _m.multiplyMatrices(bookM, part(0, b.th * 0.44, 0, b.L, b.th * 0.13, b.w)));
        boxes.setMatrixAt(b.cover[2], _m.multiplyMatrices(bookM, part(0, -b.th * 0.44, 0, b.L, b.th * 0.13, b.w)));
        pages.setMatrixAt(b.page, _m.multiplyMatrices(bookM, part(-0.012, 0, 0, b.L - 0.03, b.th * 0.76, b.w * 0.9)));
      } else {
        covers.setMatrixAt(b.cover[0], _m.multiplyMatrices(bookM, part(0, 0, 0, b.L, b.th, b.w)));
        decos.setMatrixAt(
          b.deco[0],
          _m.multiplyMatrices(bookM, part(h + 0.002, b.th * 0.3, 0, 0.012, b.th * 0.08, b.w * 0.94)),
        );
        decos.setMatrixAt(
          b.deco[1],
          _m.multiplyMatrices(bookM, part(h + 0.002, -b.th * 0.3, 0, 0.012, b.th * 0.08, b.w * 0.94)),
        );
        if (b.deco[2] !== undefined)
          decos.setMatrixAt(
            b.deco[2],
            _m.multiplyMatrices(bookM, part(h + 0.003, 0, 0, 0.012, b.th * 0.28, b.w * 0.45)),
          );
      }
    }
    covers.instanceMatrix.needsUpdate = true;
    boxes.instanceMatrix.needsUpdate = true;
    pages.instanceMatrix.needsUpdate = true;
    decos.instanceMatrix.needsUpdate = true;
  }
  writeBooks();

  // ---------- ağaç ----------
  const tree = new THREE.Group();
  tree.position.copy(BASE);
  root.add(tree);
  const tb = new Batch();
  const BARK = '#9A6B4F';
  const BARK2 = '#B98C69';
  const TH = 0.5; // gövde yüksekliği
  const V2 = (a: number, b: number) => new THREE.Vector2(a, b);
  tb.add(
    new THREE.LatheGeometry(
      [
        V2(0, -0.04),
        V2(0.2, -0.04),
        V2(0.15, 0.0),
        V2(0.1, 0.07),
        V2(0.085, 0.2),
        V2(0.07, TH),
        V2(0.05, TH + 0.08),
        V2(0, TH + 0.08),
      ],
      18,
    ),
    BARK,
  );
  // burgulu gövde telleri
  for (let k = 0; k < 3; k++) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10;
      const a = (k / 3) * Math.PI * 2 + u * Math.PI * 1.6;
      const rad = 0.1 - u * 0.04 + (i === 0 ? 0.05 : 0);
      pts.push(new THREE.Vector3(Math.cos(a) * rad, -0.02 + u * (TH + 0.03), Math.sin(a) * rad));
    }
    tb.add(tube(pts, 0.04 - k * 0.004, 28, 7), k === 1 ? BARK2 : BARK);
  }
  // dallar
  const clusters: [number, number, number, number][] = [
    [0.0, 0.97, 0.0, 0.33],
    [-0.56, 0.74, 0.06, 0.27],
    [0.56, 0.76, -0.04, 0.27],
    [-0.26, 0.8, 0.4, 0.25],
    [0.3, 0.76, 0.36, 0.25],
    [0.18, 0.86, -0.4, 0.27],
    [-0.34, 0.85, -0.32, 0.25],
  ];
  const tips = clusters.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  tips.forEach((tp, i) => {
    const start = new THREE.Vector3(0, TH - 0.06 + (i % 3) * 0.03, 0);
    const mid = new THREE.Vector3(tp.x * 0.45, (start.y + tp.y) / 2 - 0.02, tp.z * 0.45);
    const end = tp.clone().multiplyScalar(0.92);
    tb.add(tube([start, mid, end], i === 0 ? 0.045 : 0.034, 16, 6), i % 2 ? BARK2 : BARK);
    // ince sürgün
    const tw = end.clone().add(new THREE.Vector3(rr(-0.15, 0.15), 0.08, rr(-0.15, 0.15)));
    tb.add(tube([mid.clone().lerp(end, 0.55), tw], 0.018, 8, 5), BARK);
  });
  // salıncak (bir daldan sarkan, üstünde kitap)
  const swingPivot = new THREE.Group();
  const swingAt = new THREE.Vector3(-0.32, 0.545, 0.17);
  swingPivot.position.copy(swingAt);
  tree.add(swingPivot);
  const swb = new Batch();
  swb.add(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4), PAL.cream, M(-0.045, -0.13, 0));
  swb.add(new THREE.CylinderGeometry(0.004, 0.004, 0.26, 4), PAL.cream, M(0.045, -0.13, 0));
  swb.add(rbox(0.13, 0.018, 0.06, 0.006, 1), PAL.apricot, M(0, -0.265, 0));
  swb.add(rbox(0.07, 0.012, 0.05, 0.004, 1), PAL.coral, M(0.0, -0.25, 0.0, 0, 0, 0.0));
  swb.add(new THREE.BoxGeometry(0.06, 0.01, 0.04), '#FFF6E6', M(0.0, -0.243, 0.0));
  const swing = new THREE.Mesh(swb.geometry(), vclay());
  swingPivot.add(swing);
  // fener (gece parlar)
  const lanternAt = new THREE.Vector3(0.36, 0.6, 0.13);
  tb.add(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 4), PAL.cocoa, M(lanternAt.x, lanternAt.y - 0.05, lanternAt.z));
  tb.add(new THREE.ConeGeometry(0.035, 0.03, 8), PAL.cocoa, M(lanternAt.x, lanternAt.y - 0.11, lanternAt.z));
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#FFE08A',
    emissive: '#FFC94D',
    emissiveIntensity: 0.6,
    roughness: 0.5,
  });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 10), lampMat);
  lamp.position.set(lanternAt.x, lanternAt.y - 0.145, lanternAt.z);
  tree.add(lamp);
  // taç gövdesi: yumuşak yeşil kil öbekleri (yaprakların oturduğu kubbe)
  clusters.forEach(([x, y, z, r], i) => {
    tb.add(new THREE.IcosahedronGeometry(r * 0.74, 2), i % 2 ? '#8FD694' : '#79C98A', M(x, y, z, 0, i, 0, 1, 0.82, 1));
    tb.add(
      new THREE.IcosahedronGeometry(r * 0.45, 1),
      '#9FDDA0',
      M(x + r * 0.4, y + r * 0.18, z - r * 0.28, 0, 0, 0, 1, 0.8, 1),
    );
  });
  const treeStatic = tb.mesh();
  tree.add(treeStatic);

  // taç: yeşil yapraklar + parlayan yıldız yapraklar
  const leafDirs: { c: number; d: THREE.Vector3; r: number }[] = [];
  const NLEAF = 50;
  const NSTAR = 140;
  for (let i = 0; i < NLEAF + NSTAR; i++) {
    const c = i % clusters.length;
    const d = new THREE.Vector3(rr(-1, 1), rr(-0.35, 1), rr(-1, 1)).normalize();
    leafDirs.push({ c, d, r: clusters[c][3] * 0.77 + (i < NLEAF ? 0.0 : 0.012) });
  }
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, clay(PAL.white), NLEAF);
  const starMat = new THREE.MeshStandardMaterial({
    color: '#FFE9A8',
    emissive: '#FFD46B',
    emissiveIntensity: 0.5,
    roughness: 0.6,
  });
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.05, 0.022), { depth: 0.018, bevelEnabled: false }).translate(
    0,
    0,
    -0.009,
  );
  const starLeaves = new THREE.InstancedMesh(starGeo, starMat, NSTAR);
  const canopy = new THREE.Group();
  tree.add(canopy);
  canopy.add(leaves, starLeaves);
  const leafCols = ['#7CCB86', '#8FD694', '#5DB57A', '#9FE0A6', '#4FC7B8'];
  const starCols = ['#FFFFFF', '#FFF2C4', '#FFE08A', '#FFD3A0'];
  for (let i = 0; i < NLEAF; i++) leaves.setColorAt(i, _c.set(leafCols[i % leafCols.length]));
  for (let i = 0; i < NSTAR; i++) starLeaves.setColorAt(i, _c.set(starCols[i % starCols.length]));
  const leafQ: THREE.Quaternion[] = leafDirs.map((ld) =>
    new THREE.Quaternion()
      .setFromUnitVectors(new THREE.Vector3(0, 0, 1), ld.d)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rnd() * 6)),
  );
  const leafPos: THREE.Vector3[] = leafDirs.map((ld) =>
    tips[ld.c].clone().add(new THREE.Vector3(ld.d.x * ld.r, ld.d.y * ld.r * 0.82, ld.d.z * ld.r)),
  );

  // ---------- kablo kökler ----------
  const cb = new Batch();
  const cableCols = [PAL.periwinkle, PAL.butter, PAL.coral, PAL.mint, PAL.lilac, PAL.sky, BARK, BARK2];
  const curves: THREE.CatmullRomCurve3[] = [];
  const CABLE_R = R + 0.09;
  for (let k = 0; k < cableCols.length; k++) {
    const ph0 = (k / cableCols.length) * Math.PI * 2 + 0.3;
    const thEnd = k % 3 === 0 ? rr(1.9, 2.4) : rr(1.0, 1.7);
    const wig = rr(0.35, 0.6) * (k % 2 ? 1 : -1);
    const pts: THREE.Vector3[] = [new THREE.Vector3(Math.cos(ph0) * 0.11, BASE.y + 0.02, Math.sin(ph0) * 0.11)];
    for (let i = 0; i <= 9; i++) {
      const s = i / 9;
      const th = 0.32 + s * (thEnd - 0.32);
      const ph = ph0 + Math.sin(s * 4.2 + k) * wig * Math.min(1, s * 2);
      pts.push(sph(th, ph, CABLE_R - (i === 0 ? -0.02 : 0), new THREE.Vector3()));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    curves.push(curve);
    const isRoot = k >= 6;
    cb.add(new THREE.TubeGeometry(curve, 36, isRoot ? 0.028 : 0.018, 6, false), cableCols[k]);
    if (!isRoot) {
      // uçta fiş: kitaba takılı
      const end = curve.getPointAt(1);
      const tan = curve.getTangentAt(1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      const mm = new THREE.Matrix4().compose(end.clone().addScaledVector(tan, 0.03), q, new THREE.Vector3(1, 1, 1));
      cb.add(rbox(0.05, 0.06, 0.038, 0.012, 1), cableCols[k], mm);
      cb.add(new THREE.BoxGeometry(0.036, 0.04, 0.02), PAL.steel, mm.clone().multiply(M(0, 0.045, 0)));
    } else {
      // kök ucu: sivri uç
      const end = curve.getPointAt(1);
      const tan = curve.getTangentAt(1);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      cb.add(
        new THREE.ConeGeometry(0.03, 0.08, 7),
        cableCols[k],
        new THREE.Matrix4().compose(end.clone().addScaledVector(tan, 0.035), q, new THREE.Vector3(1, 1, 1)),
      );
    }
    // örgülü eşlik eden ince kablo (bazılarında)
    if (k === 0 || k === 3) {
      const twist: THREE.Vector3[] = [];
      const tmp = new THREE.Vector3();
      const nrm = new THREE.Vector3();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60;
        curve.getPointAt(u, tmp);
        nrm.copy(tmp).sub(C).normalize();
        const tan = curve.getTangentAt(u);
        const side = new THREE.Vector3().crossVectors(tan, nrm).normalize();
        const a = u * Math.PI * 14;
        twist.push(
          tmp
            .clone()
            .addScaledVector(side, Math.cos(a) * 0.03)
            .addScaledVector(nrm, Math.sin(a) * 0.022),
        );
      }
      cb.add(tube(twist, 0.009, 110, 4), k === 0 ? PAL.coral : PAL.butter);
    }
  }
  root.add(cb.mesh());
  // kablolarda yukarı akan ışık
  const NPULSE = 12;
  const pulseMat = new THREE.MeshBasicMaterial({
    color: '#FFF4C2',
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), pulseMat, NPULSE);
  pulses.frustumCulled = false;
  root.add(pulses);

  // ---------- merdiven ----------
  const PHL = 0.62; // merdivenin açısı
  const TH0 = 0.74;
  const TH1 = 1.86;
  const LAD_R = R + 0.13;
  const halfW = 0.075;
  const lb = new Batch();
  for (const sd of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 12; i++) {
      const th = TH0 - 0.05 + ((TH1 - TH0 + 0.08) * i) / 12;
      pts.push(sph(th, PHL + (sd * halfW) / (LAD_R * Math.sin(th)), LAD_R, new THREE.Vector3()));
    }
    lb.add(tube(pts, 0.017, 40, 6), '#C98E5E');
    // ayak tıpaları
    lb.add(
      new THREE.SphereGeometry(0.024, 8, 6),
      PAL.cocoa,
      new THREE.Matrix4().makeTranslation(pts[12].x, pts[12].y, pts[12].z),
    );
  }
  const NR = 10;
  const a0 = new THREE.Vector3();
  const a1 = new THREE.Vector3();
  for (let i = 0; i <= NR; i++) {
    const th = TH0 + ((TH1 - TH0) * i) / NR;
    sph(th, PHL - halfW / (LAD_R * Math.sin(th)), LAD_R, a0);
    sph(th, PHL + halfW / (LAD_R * Math.sin(th)), LAD_R, a1);
    const mid = a0.clone().add(a1).multiplyScalar(0.5);
    const dir = a1.clone().sub(a0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    lb.add(
      new THREE.CylinderGeometry(0.011, 0.011, dir.length(), 6),
      '#E0A874',
      new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)),
    );
  }
  // tepe yığınındaki gözlük ve kalem
  const gx = 0.12;
  const gz = 0.2;
  const gy = TOP + 0.07;
  lb.add(new THREE.TorusGeometry(0.045, 0.008, 6, 20), PAL.ink, M(gx - 0.05, gy, gz, Math.PI / 2 - 0.1, 0, 0.15));
  lb.add(
    new THREE.TorusGeometry(0.045, 0.008, 6, 20),
    PAL.ink,
    M(gx + 0.055, gy + 0.005, gz - 0.01, Math.PI / 2 - 0.1, 0, 0.15),
  );
  lb.add(
    new THREE.CylinderGeometry(0.006, 0.006, 0.025, 4),
    PAL.ink,
    M(gx + 0.002, gy + 0.004, gz - 0.005, 0, 0, Math.PI / 2),
  );
  lb.add(new THREE.CircleGeometry(0.04, 16), '#DDF3FF', M(gx - 0.05, gy - 0.001, gz, -Math.PI / 2 - 0.1, 0, 0.15));
  lb.add(
    new THREE.CircleGeometry(0.04, 16),
    '#DDF3FF',
    M(gx + 0.055, gy + 0.004, gz - 0.01, -Math.PI / 2 - 0.1, 0, 0.15),
  );
  lb.add(
    new THREE.CylinderGeometry(0.018, 0.018, 0.26, 6),
    PAL.butter,
    M(-0.18, TOP + 0.07, 0.08, 0, 0.6, Math.PI / 2 - 0.05),
  );
  lb.add(
    new THREE.ConeGeometry(0.018, 0.05, 6),
    '#F6D9B0',
    M(-0.18 - 0.155 * Math.cos(0.6), TOP + 0.077, 0.08 + 0.155 * Math.sin(0.6), 0, 0.6, Math.PI / 2 - 0.05),
  );
  lb.add(
    new THREE.CylinderGeometry(0.019, 0.019, 0.03, 8),
    PAL.pink,
    M(-0.18 + 0.145 * Math.cos(0.6), TOP + 0.063, 0.08 - 0.145 * Math.sin(0.6), 0, 0.6, Math.PI / 2 - 0.05),
  );
  // minik mantarlar
  for (const [x, z, k] of [
    [-0.12, -0.12, 1],
    [-0.07, -0.16, 0.7],
    [0.17, -0.05, 0.8],
  ]) {
    lb.add(new THREE.CylinderGeometry(0.012 * k, 0.015 * k, 0.04 * k, 6), PAL.cream, M(x, TOP + 0.085 + 0.02 * k, z));
    lb.add(
      new THREE.SphereGeometry(0.03 * k, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      PAL.coral,
      M(x, TOP + 0.085 + 0.04 * k, z),
    );
  }
  root.add(lb.mesh());
  root.add(new THREE.Mesh(sb.geometry(), vclay()));

  // ---------- tırmanan öğrenci ----------
  const climber = new THREE.Group();
  root.add(climber);
  const kb = new Batch();
  kb.add(new THREE.CapsuleGeometry(0.042, 0.05, 4, 10), PAL.coral, M(0, 0.04, 0));
  kb.add(new THREE.SphereGeometry(0.045, 14, 10), '#FFD9BE', M(0, 0.125, 0));
  kb.add(
    new THREE.SphereGeometry(0.047, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    '#5a3a33',
    M(0, 0.13, -0.004, -0.25, 0, 0),
  );
  kb.add(new THREE.SphereGeometry(0.018, 8, 6), '#5a3a33', M(0, 0.15, -0.045));
  kb.add(rbox(0.07, 0.075, 0.035, 0.014, 1), PAL.butter, M(0, 0.055, -0.045));
  kb.add(rbox(0.05, 0.03, 0.01, 0.006, 1), '#e3ad2f', M(0, 0.04, -0.064));
  // sırt çantasından çıkan bayrak (kitap ayracı)
  kb.add(new THREE.CylinderGeometry(0.003, 0.003, 0.11, 4), PAL.cocoa, M(0.025, 0.13, -0.05));
  kb.add(new THREE.BoxGeometry(0.004, 0.03, 0.045), PAL.mint, M(0.025, 0.17, -0.073));
  climber.add(new THREE.Mesh(kb.geometry(), vclay()));
  const limbs = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.014, 0.05, 3, 6).translate(0, 0.032, 0),
    clay('#FFD9BE'),
    4,
  );
  limbs.frustumCulled = false;
  const legCol = new THREE.Color('#5C8FD6');
  limbs.setColorAt(0, _c.set(PAL.coral));
  limbs.setColorAt(1, _c.set(PAL.coral));
  limbs.setColorAt(2, legCol);
  limbs.setColorAt(3, legCol);
  climber.add(limbs);
  const climbM = new THREE.Matrix4();

  // ---------- kurdele ayraçlar (dalgalanır) ----------
  const ribbonBooks = books.filter((b) => !b.fore && b.layer >= 2 && b.layer <= layers.length - 2);
  const ribbons: Book[] = [];
  for (let i = 0; i < 5 && ribbonBooks.length; i++)
    ribbons.push(ribbonBooks[Math.floor((i / 5) * ribbonBooks.length + 3) % ribbonBooks.length]);
  const RS = 8;
  const ribCols = [PAL.pink, PAL.butter, PAL.mint, PAL.coral, PAL.lilac];
  const ribGeo = new THREE.BufferGeometry();
  const ribPos = new Float32Array(ribbons.length * (RS + 1) * 2 * 3);
  const ribCol = new Float32Array(ribPos.length);
  const ribIdx: number[] = [];
  ribbons.forEach((_, ri) => {
    _c.set(ribCols[ri % ribCols.length]);
    for (let i = 0; i <= RS; i++)
      for (let j = 0; j < 2; j++) {
        const v = (ri * (RS + 1) + i) * 2 + j;
        ribCol[v * 3] = _c.r;
        ribCol[v * 3 + 1] = _c.g;
        ribCol[v * 3 + 2] = _c.b;
      }
    for (let i = 0; i < RS; i++) {
      const a = (ri * (RS + 1) + i) * 2;
      ribIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  ribGeo.setAttribute('position', new THREE.BufferAttribute(ribPos, 3));
  ribGeo.setAttribute('color', new THREE.BufferAttribute(ribCol, 3));
  ribGeo.setIndex(ribIdx);
  const ribMesh = new THREE.Mesh(ribGeo, vclay(THREE.DoubleSide));
  ribMesh.frustumCulled = false;
  root.add(ribMesh);

  // ---------- ateş böcekleri ----------
  const NFLY = 22;
  const flyMat = new THREE.MeshBasicMaterial({
    color: '#FFF1A8',
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: '#FFD46B',
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const flyGeo = new THREE.SphereGeometry(1, 6, 4);
  const flies = new THREE.InstancedMesh(flyGeo, flyMat, NFLY);
  const halos = new THREE.InstancedMesh(flyGeo, haloMat, NFLY);
  flies.frustumCulled = halos.frustumCulled = false;
  root.add(flies, halos);
  const flyP = Array.from({ length: NFLY }, () => ({
    rx: rr(0.35, 1.0),
    rz: rr(0.35, 1.0),
    y: rr(0.55, 1.45),
    sp: rr(0.25, 0.6) * (rnd() < 0.5 ? -1 : 1),
    ph: rnd() * 6.28,
    bob: rr(0.6, 1.6),
  }));

  // ---------- dürtünce: yeni dal + çiçekler + kıvılcım ----------
  const nbCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.02, TH - 0.2, 0.03),
    new THREE.Vector3(-0.2, TH - 0.12, 0.25),
    new THREE.Vector3(-0.45, TH - 0.05, 0.42),
    new THREE.Vector3(-0.66, TH + 0.08, 0.5),
    new THREE.Vector3(-0.78, TH + 0.2, 0.45),
  ]);
  const NBSEG = 48;
  const NBRAD = 7;
  const newBranch = new THREE.Mesh(new THREE.TubeGeometry(nbCurve, NBSEG, 0.026, NBRAD, false), clay(BARK2));
  newBranch.geometry.setDrawRange(0, 0);
  newBranch.frustumCulled = false;
  tree.add(newBranch);
  const fb = new Batch();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    fb.add(
      new THREE.SphereGeometry(1, 7, 5),
      PAL.pink,
      M(Math.cos(a) * 0.8, Math.sin(a) * 0.8, 0, 0, 0, a, 0.75, 0.55, 0.3),
    );
  }
  fb.add(new THREE.SphereGeometry(0.42, 7, 5), PAL.butter, M(0, 0, 0.12));
  const NFL = 7;
  const flowers = new THREE.InstancedMesh(fb.geometry(), vclay(), NFL);
  flowers.frustumCulled = false;
  tree.add(flowers);
  const flowerU = [0.42, 0.55, 0.66, 0.76, 0.86, 0.94, 1.0];
  const flowerSide = flowerU.map((_, i) =>
    new THREE.Vector3(Math.cos(i * 2.3), 0.6 + Math.sin(i * 1.7) * 0.4, Math.sin(i * 2.3)).normalize(),
  );
  const NSP = 36;
  const sparkMat = new THREE.MeshBasicMaterial({
    color: '#FFF4C2',
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), sparkMat, NSP);
  sparks.frustumCulled = false;
  tree.add(sparks);
  const sparkFrom = Array.from({ length: NSP }, (_, i) => leafPos[(i * 7) % leafPos.length].clone());
  const sparkVel = sparkFrom.map((p, i) => {
    const c = tips[leafDirs[(i * 7) % leafPos.length].c];
    return p
      .clone()
      .sub(c)
      .normalize()
      .multiplyScalar(rr(0.5, 0.9))
      .add(new THREE.Vector3(0, rr(0.3, 0.7), 0));
  });

  // ---------- durum ----------
  const shot = new OneShot(3);
  let branchAge = 99;
  let shuffleT = 99;
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3();
  const outV = new THREE.Vector3();
  const side = new THREE.Vector3();
  const tan = new THREE.Vector3();
  let flyBoost = 0;

  function update(s: Parameters<Character['update']>[0]) {
    const dt = s.dt;
    const t = s.t;
    const hov = s.hover;
    const red = s.reduce ? 0.25 : 1;
    const live = 1 + hov;
    const p = shot.tick(dt);
    const on = p >= 0;
    branchAge += dt;
    shuffleT += dt;

    // gezegen: hafif salınım + dürtünce esneyip zıplama
    const squash = on ? Math.sin(Math.min(1, p / 0.18) * Math.PI) * 0.06 : 0;
    root.position.y = -0.24 + Math.sin(t * 0.8) * 0.03 * red + squash * 0.6;
    root.rotation.y = Math.sin(t * 0.21) * 0.15 * red;
    root.scale.set(SC * (1 + squash * 0.4), SC * (1 + squash * 0.3), SC * (1 + squash * 0.4));

    // ağaç salınır
    tree.rotation.z = Math.sin(t * 0.7) * 0.03 * red + (on ? Math.sin(p * Math.PI * 4) * 0.04 * (1 - p) : 0);
    tree.rotation.x = Math.sin(t * 0.53 + 1) * 0.025 * red;
    canopy.rotation.y = Math.sin(t * 0.4) * 0.04 * red;
    swingPivot.rotation.z = Math.sin(t * 1.6) * 0.25 * red;
    swingPivot.rotation.x = Math.sin(t * 1.1) * 0.08 * red;

    // kitaplar karışır (dürtünce)
    if (shuffleT < 2.4) {
      for (let li = 0; li < layers.length; li++) {
        const k = shuffleT - li * 0.06;
        const env = k > 0 ? Math.exp(-k * 2.2) * Math.sin(k * 9) : 0;
        layerRot[li] = env * 0.32 * (li % 2 ? 1 : -1);
        layerPush[li] = Math.abs(env) * 0.07;
      }
      writeBooks();
    } else if (shuffleT < 3) {
      layerRot.fill(0);
      layerPush.fill(0);
      writeBooks();
      shuffleT = 3;
    }

    // yapraklar ışıldar
    const burst = on ? Math.sin(Math.min(1, p / 0.5) * Math.PI) : 0;
    for (let i = 0; i < NLEAF + NSTAR; i++) {
      const ld = leafDirs[i];
      const lp = leafPos[i];
      const wv = Math.sin(t * (1.8 + (i % 5) * 0.3) * live + i * 1.3);
      _v.copy(lp).addScaledVector(ld.d, wv * 0.012 * red + burst * 0.08);
      _q.copy(leafQ[i]).multiply(_q2.setFromAxisAngle(ZA, wv * 0.25 * red));
      if (i < NLEAF) {
        const sc = 0.045 * (1 + burst * 0.2);
        _m.compose(_v, _q, _s.set(sc, sc * 0.55, sc * 0.3));
        leaves.setMatrixAt(i, _m);
      } else {
        const j = i - NLEAF;
        const tw = 0.85 + 0.3 * Math.sin(t * (2.5 + (j % 7) * 0.4) * live + j * 2.1);
        const sc = tw * (1 + burst * 0.5) * (1.05 + (j % 3) * 0.18);
        _m.compose(_v, _q, _s.set(sc, sc, sc));
        starLeaves.setMatrixAt(j, _m);
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    starLeaves.instanceMatrix.needsUpdate = true;
    starMat.emissiveIntensity = 0.6 + 0.8 * s.night + 0.35 * hov + 0.12 * Math.sin(t * 2) + burst * 0.8;
    lampMat.emissiveIntensity = 0.5 + 1.6 * s.night + Math.sin(t * 7) * 0.08;

    // kablolarda ışık akışı (köklerden ağaca)
    for (let i = 0; i < NPULSE; i++) {
      const ci = i % 6;
      const u = 1 - ((t * 0.18 * live * red + i * 0.37 + (i >= 6 ? 0.5 : 0)) % 1);
      curves[ci].getPointAt(u, tmp);
      const sc = 0.028 * Math.sin(u * Math.PI) * (1 + s.night * 0.3) * (1 + burst);
      _m.compose(tmp, _q.identity(), _s.set(sc, sc, sc));
      pulses.setMatrixAt(i, _m);
    }
    pulses.instanceMatrix.needsUpdate = true;
    pulseMat.opacity = 0.55 + 0.4 * s.night;

    // ateş böcekleri
    flyBoost = damp(flyBoost, burst, 6, dt);
    for (let i = 0; i < NFLY; i++) {
      const f = flyP[i];
      const a = t * f.sp * live * red + f.ph;
      const spread = 1 + flyBoost * 0.35;
      tmp.set(Math.cos(a) * f.rx * spread, f.y + Math.sin(t * f.bob + f.ph) * 0.12, Math.sin(a) * f.rz * spread);
      const blink = 0.5 + 0.5 * Math.sin(t * (2 + f.bob) + f.ph * 3);
      const sc = 0.014 + 0.01 * blink;
      _m.compose(tmp.add(BASE), _q.identity(), _s.set(sc, sc, sc));
      flies.setMatrixAt(i, _m);
      const hs = sc * (2.2 + hov * 0.8);
      _m.compose(tmp, _q, _s.set(hs, hs, hs));
      halos.setMatrixAt(i, _m);
    }
    flies.instanceMatrix.needsUpdate = true;
    halos.instanceMatrix.needsUpdate = true;
    haloMat.opacity = 0.1 + 0.12 * s.night + 0.08 * hov;

    // kurdeleler dalgalanır
    let vi = 0;
    for (let ri = 0; ri < ribbons.length; ri++) {
      const b = ribbons[ri];
      bookMatrix(b, bookM);
      // kitabın dış alt kenarı
      tmp.set(b.L / 2 - 0.005, -b.th * 0.2, b.w * 0.15).applyMatrix4(bookM);
      outV.set(Math.cos(b.ph + layerRot[b.layer]), 0, Math.sin(b.ph + layerRot[b.layer]));
      side.set(-outV.z, 0, outV.x);
      for (let i = 0; i <= RS; i++) {
        const u = i / RS;
        const fl = Math.sin(t * 4.2 * live * red - u * 5 + ri) * 0.035 * u;
        const len = 0.24 * u;
        const notch = i === RS ? 0.02 : 0;
        for (let j = 0; j < 2; j++) {
          const sd = j ? 1 : -1;
          const px = tmp.x + outV.x * (0.015 + u * 0.05 + fl) + side.x * (sd * 0.022 + fl * 0.6);
          const pz = tmp.z + outV.z * (0.015 + u * 0.05 + fl) + side.z * (sd * 0.022 + fl * 0.6);
          ribPos[vi++] = px;
          ribPos[vi++] = tmp.y - len + notch;
          ribPos[vi++] = pz;
        }
      }
    }
    (ribGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    ribGeo.computeVertexNormals();

    // tırmanıcı: basamak basamak çıkar, tepede el sallar, kayarak iner
    const CY = 12;
    const cyc = (t * (1 + hov * 0.5) * (s.reduce ? 0.3 : 1)) % CY;
    let u = 0;
    let stepPh = 0;
    let waveA = 0;
    if (cyc < 8) {
      const k = (cyc / 8) * NR;
      u = (Math.floor(k) + smooth(0.15, 0.85, k % 1)) / NR;
      stepPh = k;
    } else if (cyc < 9.6) {
      u = 1;
      waveA = Math.sin((cyc - 8) * 9);
    } else if (cyc < 10.6) u = 1 - ease.inOut((cyc - 9.6) / 1);
    else u = 0;
    const cheer = on ? Math.sin(Math.PI * p) : 0;
    const th = TH1 - 0.06 - u * (TH1 - TH0 - 0.06);
    sph(th, PHL, LAD_R + 0.06, tmp);
    outV.copy(tmp).sub(C).normalize();
    up.set(-Math.cos(th) * Math.cos(PHL), Math.sin(th), -Math.cos(th) * Math.sin(PHL)).normalize();
    side.crossVectors(up, outV).normalize();
    tan.copy(outV).negate();
    climbM.makeBasis(side.negate(), up, tan);
    climbM.setPosition(tmp.addScaledVector(up, -0.06 + cheer * 0.05));
    climber.matrixAutoUpdate = false;
    climber.matrix.copy(climbM);
    // kollar ve bacaklar
    const sw = Math.sin(stepPh * Math.PI);
    const climbing = cyc < 8 ? 1 : 0;
    const limbsLocal: [number, number, number, number, number][] = [
      [-0.045, 0.075, 0.01, -2.6 + sw * 0.5 * climbing - cheer * 0.3, 0.3 + (waveA ? 0 : 0)],
      [
        0.045,
        0.075,
        0.01,
        waveA ? -2.9 + waveA * 0.4 : -2.6 - sw * 0.5 * climbing - cheer * 0.3,
        -0.3 - (waveA ? 0.6 : 0),
      ],
      [-0.022, 0.0, 0.01, Math.PI - 0.4 - sw * 0.4 * climbing, 0.1],
      [0.022, 0.0, 0.01, Math.PI - 0.4 + sw * 0.4 * climbing, -0.1],
    ];
    for (let i = 0; i < 4; i++) {
      const [x, y, z, rx, rz] = limbsLocal[i];
      _m.compose(_v.set(x, y, z), _q.setFromEuler(_e.set(rx, 0, rz)), _s.set(1, 1, 1));
      limbs.setMatrixAt(i, _m);
    }
    limbs.instanceMatrix.needsUpdate = true;

    // yeni dal: büyür, çiçek açar; birkaç saniye sonra çiçekler kıvılcım olup dal geri çekilir
    const grow = branchAge < 50 ? ease.out(Math.min(1, branchAge / 1.1)) * (1 - smooth(7.5, 9, branchAge)) : 0;
    newBranch.geometry.setDrawRange(0, Math.floor(grow * NBSEG) * NBRAD * 6);
    for (let i = 0; i < NFL; i++) {
      const fu = flowerU[i];
      const age = branchAge - 0.4 - fu * 0.9;
      let sc = 0;
      if (grow >= fu - 0.01 && branchAge < 50 && age > 0)
        sc = ease.outBack(Math.min(1, age / 0.5)) * (1 - smooth(6.8 + i * 0.1, 7.6 + i * 0.1, branchAge));
      if (sc <= 0.001) {
        flowers.setMatrixAt(i, hide);
        continue;
      }
      nbCurve.getPointAt(fu, tmp);
      tmp.addScaledVector(flowerSide[i], 0.03);
      _q.setFromUnitVectors(_v.set(0, 0, 1), flowerSide[i]);
      _q.multiply(_q2.setFromAxisAngle(_v.set(0, 0, 1), t * 0.5 + i));
      const fs = 0.05 * sc * (i === NFL - 1 ? 1.4 : 1) * (1 + 0.06 * Math.sin(t * 3 + i));
      _m.compose(tmp, _q, _s.set(fs, fs, fs));
      flowers.setMatrixAt(i, _m);
    }
    flowers.instanceMatrix.needsUpdate = true;

    // kıvılcımlar
    const sp = on ? p * 3 : 99;
    for (let i = 0; i < NSP; i++) {
      const k = (sp - (i % 6) * 0.05) / 1.8;
      if (k <= 0 || k >= 1) {
        sparks.setMatrixAt(i, hide);
        continue;
      }
      const tt = k * 1.8;
      tmp.copy(sparkFrom[i]).addScaledVector(sparkVel[i], tt);
      tmp.y -= 0.35 * tt * tt;
      const sc = 0.03 * Math.sin(k * Math.PI);
      _m.compose(tmp, _q.setFromEuler(_e.set(t * 4 + i, t * 3, 0)), _s.set(sc, sc * 1.6, sc));
      sparks.setMatrixAt(i, _m);
    }
    sparks.instanceMatrix.needsUpdate = true;
  }
  return {
    group,
    update,
    poke() {
      shot.start();
      shuffleT = 0;
      if (branchAge > 6) branchAge = 0;
    },
  };
}
