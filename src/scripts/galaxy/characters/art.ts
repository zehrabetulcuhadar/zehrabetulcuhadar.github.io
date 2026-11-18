import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  canvasTexture,
  clay,
  clayBump,
  damp,
  ease,
  glow,
  OneShot,
  PAL,
  rbox,
  smooth,
  tube,
  type Character,
} from './kit';

/**
 * Resim: ressam paleti biçiminde gezegen.
 * Başparmak delikli ahşap palet, üstünde taze boya yığınları, boya tüpü ve spatula.
 * Kenarlardan boya damlaları sarkar: damla büyür, uzar, kopar ve uzaya düşer; yerine yenisi oluşur.
 * Fırça kuyruklu yıldız, yörüngesinde Van Gogh "Yıldızlı Gece" girdaplı bir halka boyar.
 * Tıklanınca fırça bir boya yığınına daldırılır, renkli bir sıçrama olur ve halka yeni renklerle yeniden boyanır.
 */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _v = new THREE.Vector3();
const _c = new THREE.Color();
type V3 = [number, number, number];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** Aynı malzemeli statik parçaları tek çizim çağrısında birleştirir. */
class Merger {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scl: V3 = [1, 1, 1]) {
    const g = prep(geo);
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
    g.applyMatrix4(_m);
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
  }
  build(parent: THREE.Object3D) {
    for (const [mat, list] of this.parts) {
      const merged = mergeGeometries(list, false);
      if (merged) parent.add(new THREE.Mesh(merged, mat));
      list.forEach((g) => g.dispose());
    }
    this.parts.clear();
  }
}
/** Birleştirmeye hazırla: indekssiz, sadece position/normal/uv. */
function prep(geo: THREE.BufferGeometry) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  geo.dispose();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
  if (!g.attributes.uv)
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.clearGroups();
  return g;
}
function mergeAll(list: THREE.BufferGeometry[]) {
  return mergeGeometries(list.map(prep), false)!;
}

function smoothPts(pts: [number, number][], n: number) {
  const c = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  );
  return c.getPoints(n).map((p) => new THREE.Vector2(p.x, p.y));
}

/** Damla: üstü sivri, altı yuvarlak (yarıçap 1, y -1..1). */
function teardrop(seg = 14) {
  const pts: THREE.Vector2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const u = i / n; // 0 alt, 1 üst
    const r = Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.cos((Math.PI * u) / 2)) * 1.25;
    pts.push(new THREE.Vector2(Math.max(0.0001, Math.min(1, r)), -Math.cos(Math.PI * u)));
  }
  return new THREE.LatheGeometry(pts, seg);
}

/** Van Gogh tarzı girdaplı halka dokusu (düzlemsel UV, halka 205..256 px arası). */
function swirlTexture(cols: string[]) {
  return canvasTexture(512, 512, (x, w) => {
    const c = w / 2;
    const r0 = 196;
    const r1 = 256;
    x.fillStyle = cols[0];
    x.fillRect(0, 0, w, w);
    x.lineCap = 'round';
    // akan, teğet fırça darbeleri
    for (let i = 0; i < 1500; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = r0 + Math.random() * (r1 - r0);
      const len = 0.05 + Math.random() * 0.08;
      const wav = Math.sin(a * 9 + r * 0.15) * 6;
      x.strokeStyle = cols[1 + Math.floor(Math.random() * 3)];
      x.globalAlpha = 0.55 + Math.random() * 0.45;
      x.lineWidth = 2 + Math.random() * 3;
      x.beginPath();
      x.arc(c, c, r + wav, a, a + len);
      x.stroke();
    }
    x.globalAlpha = 1;
    // girdaplar
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + Math.random() * 0.3;
      const r = (r0 + r1) / 2;
      const sx = c + Math.cos(a) * r;
      const sy = c + Math.sin(a) * r;
      for (let j = 0; j < 3; j++) {
        x.strokeStyle = j === 0 ? cols[3] : j === 1 ? cols[4] : cols[2];
        x.lineWidth = 3;
        x.beginPath();
        for (let q = 0; q <= 40; q++) {
          const tt = q / 40;
          const rr = 3 + tt * (16 - j * 3);
          const aa = tt * Math.PI * 4 + j * 2;
          const px = sx + Math.cos(aa) * rr;
          const py = sy + Math.sin(aa) * rr;
          if (q) x.lineTo(px, py);
          else x.moveTo(px, py);
        }
        x.stroke();
      }
    }
    // yıldızlar
    for (let k = 0; k < 26; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = r0 + 8 + Math.random() * (r1 - r0 - 16);
      const sx = c + Math.cos(a) * r;
      const sy = c + Math.sin(a) * r;
      x.fillStyle = cols[4];
      x.globalAlpha = 0.5;
      x.beginPath();
      x.arc(sx, sy, 6, 0, Math.PI * 2);
      x.fill();
      x.globalAlpha = 1;
      x.fillStyle = cols[3];
      x.beginPath();
      x.arc(sx, sy, 3, 0, Math.PI * 2);
      x.fill();
    }
    // iç/dış kenar vurgusu
    x.strokeStyle = cols[4];
    x.lineWidth = 3;
    x.globalAlpha = 0.8;
    [r0 + 2, r1 - 3].forEach((r) => {
      x.beginPath();
      x.arc(c, c, r, 0, Math.PI * 2);
      x.stroke();
    });
    x.globalAlpha = 1;
  });
}

export default function create(): Character {
  const group = new THREE.Group();

  // ---------- palet ----------
  const pal = new THREE.Group();
  pal.rotation.set(-0.38, 0.1, 0.12);
  pal.position.y = -0.2;
  group.add(pal);
  const outline: [number, number][] = [
    [-1.0, 0.08],
    [-0.92, 0.5],
    [-0.6, 0.78],
    [-0.1, 0.86],
    [0.42, 0.78],
    [0.84, 0.52],
    [1.02, 0.16],
    [0.98, -0.14],
    [0.82, -0.26],
    [0.66, -0.3],
    [0.58, -0.46],
    [0.6, -0.62],
    [0.4, -0.78],
    [-0.05, -0.86],
    [-0.5, -0.8],
    [-0.84, -0.52],
  ];
  const opts = smoothPts(outline, 120);
  const shape = new THREE.Shape(opts);
  const hole = new THREE.Path();
  hole.absellipse(0.66, 0.06, 0.16, 0.13, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  const T = 0.16;
  const BV = 0.06;
  const palGeo = new THREE.ExtrudeGeometry(shape, {
    depth: T,
    bevelEnabled: true,
    bevelThickness: BV,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 40,
  });
  palGeo.translate(0, 0, -T / 2);
  {
    // kapaklar tek grupta: ilk yarı arka (z-), ikinci yarı ön yüz. Arka yüz düz ahşap olsun.
    const [caps, sides] = palGeo.groups;
    const half = caps.count / 2;
    palGeo.clearGroups();
    palGeo.addGroup(caps.start, half, 2);
    palGeo.addGroup(caps.start + half, half, 0);
    palGeo.addGroup(sides.start, sides.count, 1);
  }
  const faceZ = T / 2 + BV;
  const woodTex = canvasTexture(512, 512, (x, w) => {
    const P = (u: number, v: number): [number, number] => [(u / 2.2 + 0.5) * w, (1 - (v / 2.2 + 0.5)) * w];
    x.fillStyle = '#F6DDB0';
    x.fillRect(0, 0, w, w);
    // ahşap damarları
    for (let i = 0; i < 26; i++) {
      x.strokeStyle = `rgba(190,130,80,${0.08 + Math.random() * 0.1})`;
      x.lineWidth = 2 + Math.random() * 4;
      x.beginPath();
      const y0 = Math.random() * w;
      for (let k = 0; k <= 20; k++) {
        const px = (k / 20) * w;
        const py = y0 + Math.sin(k * 0.6 + i) * 10 + Math.sin(k * 0.17 + i * 2) * 18;
        if (k) x.lineTo(px, py);
        else x.moveTo(px, py);
      }
      x.stroke();
    }
    // kurumuş boya lekeleri ve karışım izleri
    const smear = (u: number, v: number, col: string, r: number, ang: number) => {
      const [px, py] = P(u, v);
      x.save();
      x.translate(px, py);
      x.rotate(ang);
      // kuru fırça darbesi: üst üste binen ince kıl izleri, uçları incelir
      x.strokeStyle = col;
      x.lineCap = 'round';
      for (let k = 0; k < 9; k++) {
        const off = (k - 4) * r * 0.12;
        x.globalAlpha = 0.25 + Math.random() * 0.35;
        x.lineWidth = r * (0.12 + Math.random() * 0.16);
        x.beginPath();
        x.moveTo(-r * (1.2 + Math.random() * 0.6), off);
        x.bezierCurveTo(
          -r * 0.4,
          off - r * 0.5,
          r * 0.5,
          off + r * 0.5,
          r * (1.3 + Math.random() * 0.7),
          off - r * 0.2,
        );
        x.stroke();
      }
      x.globalAlpha = 0.6;
      x.fillStyle = col;
      x.beginPath();
      x.arc(-r * 1.3, 0, r * 0.45, 0, Math.PI * 2);
      x.fill();
      x.restore();
    };
    smear(0.1, 0.12, PAL.lilac, 22, 0.4);
    smear(0.0, -0.05, PAL.sky, 16, -0.3);
    smear(-0.35, 0.05, PAL.pink, 18, 0.9);
    smear(0.3, -0.3, PAL.mint, 15, -0.6);
    smear(-0.15, -0.35, PAL.butter, 14, 0.2);
    smear(0.28, 0.25, PAL.apricot, 12, 1.3);
    x.globalAlpha = 1;
  });
  woodTex.wrapS = woodTex.wrapT = THREE.ClampToEdgeWrapping;
  woodTex.repeat.set(1 / 2.2, 1 / 2.2);
  woodTex.offset.set(0.5, 0.5);
  const faceMat = new THREE.MeshStandardMaterial({
    map: woodTex,
    roughness: 0.85,
    bumpMap: clayBump(),
    bumpScale: 0.6,
    emissive: '#F6DDB0',
    emissiveIntensity: 0.06,
  });
  // arka yüz: ahşap damarları + bantla yapıştırılmış küçük eskiz
  const backTex = canvasTexture(512, 512, (x, w) => {
    const P = (u: number, v: number): [number, number] => [(u / 2.2 + 0.5) * w, (1 - (v / 2.2 + 0.5)) * w];
    x.fillStyle = '#EBC892';
    x.fillRect(0, 0, w, w);
    for (let i = 0; i < 30; i++) {
      x.strokeStyle = `rgba(160,100,60,${0.1 + Math.random() * 0.12})`;
      x.lineWidth = 2 + Math.random() * 4;
      x.beginPath();
      const y0 = Math.random() * w;
      for (let k = 0; k <= 20; k++) {
        const px = (k / 20) * w;
        const py = y0 + Math.sin(k * 0.5 + i) * 9 + Math.sin(k * 0.2 + i * 3) * 16;
        if (k) x.lineTo(px, py);
        else x.moveTo(px, py);
      }
      x.stroke();
    }
    // budak
    const [kx, ky] = P(0.55, -0.45);
    x.strokeStyle = 'rgba(150,90,50,0.35)';
    for (let r = 4; r < 22; r += 5) {
      x.lineWidth = 2;
      x.beginPath();
      x.ellipse(kx, ky, r * 1.6, r, 0.2, 0, Math.PI * 2);
      x.stroke();
    }
    // eskiz kağıdı (arkadan bakınca ayna olur; yazısız çizim)
    const [sx, sy] = P(0.05, 0.38);
    x.save();
    x.translate(sx, sy);
    x.rotate(0.12);
    x.fillStyle = 'rgba(80,50,40,0.18)';
    x.fillRect(-58, -40, 120, 86);
    x.fillStyle = '#FFFBF2';
    x.fillRect(-62, -44, 120, 86);
    x.strokeStyle = '#6B5560';
    x.lineWidth = 2.2;
    x.lineCap = 'round';
    // tepeler, güneş ve kuş
    x.beginPath();
    x.moveTo(-52, 28);
    x.quadraticCurveTo(-25, -8, 0, 22);
    x.quadraticCurveTo(22, -2, 48, 26);
    x.stroke();
    x.beginPath();
    x.arc(28, -18, 11, 0, Math.PI * 2);
    x.stroke();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      x.beginPath();
      x.moveTo(28 + Math.cos(a) * 15, -18 + Math.sin(a) * 15);
      x.lineTo(28 + Math.cos(a) * 21, -18 + Math.sin(a) * 21);
      x.stroke();
    }
    x.beginPath();
    x.moveTo(-34, -22);
    x.quadraticCurveTo(-28, -30, -22, -22);
    x.quadraticCurveTo(-16, -30, -10, -22);
    x.stroke();
    x.fillStyle = PAL.coral;
    x.globalAlpha = 0.5;
    x.beginPath();
    x.arc(28, -18, 10, 0, Math.PI * 2);
    x.fill();
    x.globalAlpha = 1;
    // bant parçaları
    x.fillStyle = 'rgba(247,197,72,0.75)';
    for (const [tx, ty, ta] of [
      [-62, -44, -0.6],
      [58, -44, 0.6],
      [-62, 42, 0.6],
      [58, 42, -0.6],
    ]) {
      x.save();
      x.translate(tx, ty);
      x.rotate(ta);
      x.fillRect(-16, -6, 32, 12);
      x.restore();
    }
    x.restore();
  });
  backTex.repeat.set(1 / 2.2, 1 / 2.2);
  backTex.offset.set(0.5, 0.5);
  const backMat = new THREE.MeshStandardMaterial({
    map: backTex,
    roughness: 0.88,
    bumpMap: clayBump(),
    bumpScale: 0.6,
    emissive: '#EBC892',
    emissiveIntensity: 0.05,
  });
  const palMesh = new THREE.Mesh(palGeo, [faceMat, clay('#E8C38E'), backMat]);
  pal.add(palMesh);
  // arkada imza: "Zero" + küçük kalp
  const sig = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.28),
    new THREE.MeshStandardMaterial({
      map: canvasTexture(256, 100, (x, w, h) => {
        x.fillStyle = PAL.cocoa;
        x.font = `italic bold ${Math.round(h * 0.62)}px Georgia, serif`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('Zero ♥', w / 2, h / 2);
      }),
      transparent: true,
      roughness: 0.9,
      depthWrite: false,
    }),
  );
  sig.position.set(-0.2, -0.3, -faceZ - 0.004);
  sig.rotation.set(0, Math.PI, -0.15);
  pal.add(sig);

  // palet üstündeki statik süsler
  const M = new Merger();
  // başparmak deliği kenarında koyu halka
  M.add(new THREE.TorusGeometry(1, 0.025, 6, 40), clay('#D9AE78'), [0.66, 0.06, faceZ], [0, 0, 0], [0.165, 0.135, 1]);
  // boya tüpü (yatık, sıkılmış) — ağzından mavi boya çıkıyor
  {
    const body = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.001, 0.0),
        new THREE.Vector2(0.055, 0.0),
        new THREE.Vector2(0.075, 0.08),
        new THREE.Vector2(0.078, 0.26),
        new THREE.Vector2(0.06, 0.36),
        new THREE.Vector2(0.03, 0.4),
        new THREE.Vector2(0.001, 0.4),
      ],
      14,
    );
    body.scale(1, 1, 0.55); // sıkılmış, yassı
    const ta = 1.35; // tüp yönü
    const bx = 0.02;
    const by = 0.22;
    const dx = -Math.sin(ta);
    const dy = Math.cos(ta);
    const tz = faceZ + 0.045;
    M.add(body, clay(PAL.white), [bx, by, tz], [0, 0, ta]);
    M.add(rbox(0.17, 0.025, 0.06, 0.008, 2), clay(PAL.steel, { rough: 0.45 }), [bx, by, tz], [0, 0, ta]);
    // etiket bandı
    M.add(
      new THREE.CylinderGeometry(0.079, 0.079, 0.08, 14, 1, true),
      clay(PAL.sky),
      [bx + dx * 0.17, by + dy * 0.17, tz],
      [0, 0, ta],
      [1, 1, 0.56],
    );
    // ağız + çıkan boya
    M.add(
      new THREE.CylinderGeometry(0.022, 0.026, 0.04, 10),
      clay(PAL.steel, { rough: 0.45 }),
      [bx + dx * 0.42, by + dy * 0.42, tz],
      [0, 0, ta],
    );
    M.add(
      tube(
        [
          new THREE.Vector3(bx + dx * 0.44, by + dy * 0.44, tz),
          new THREE.Vector3(bx + dx * 0.52, by + dy * 0.5, tz - 0.01),
          new THREE.Vector3(bx + dx * 0.58, by + dy * 0.44, faceZ + 0.02),
          new THREE.Vector3(bx + dx * 0.52, by + dy * 0.38, faceZ + 0.02),
          new THREE.Vector3(bx + dx * 0.6, by + dy * 0.32, faceZ + 0.02),
        ],
        0.026,
        24,
        8,
      ),
      clay(PAL.sky, { rough: 0.38 }),
    );
    // yanında duran kapak
    M.add(
      new THREE.CylinderGeometry(0.03, 0.034, 0.05, 12),
      clay(PAL.sky),
      [bx + 0.1, by - 0.08, faceZ + 0.03],
      [Math.PI / 2, 0, 0],
    );
  }
  // spatula
  M.add(rbox(0.07, 0.26, 0.012, 0.03, 2), clay(PAL.steel, { rough: 0.45 }), [0.22, 0.34, faceZ + 0.012], [0, 0, 0.95]);
  M.add(
    tube(
      [
        new THREE.Vector3(0.33, 0.27, faceZ + 0.02),
        new THREE.Vector3(0.38, 0.24, faceZ + 0.04),
        new THREE.Vector3(0.43, 0.22, faceZ + 0.045),
      ],
      0.013,
      8,
      6,
    ),
    clay(PAL.steel, { rough: 0.45 }),
  );
  M.add(new THREE.CapsuleGeometry(0.028, 0.16, 4, 10), clay(PAL.coral), [0.53, 0.18, faceZ + 0.045], [0, 0, 1.25]);
  M.build(pal);

  // ---------- boya yığınları (instanced) ----------
  const blobParts: THREE.BufferGeometry[] = [];
  {
    const a = new THREE.SphereGeometry(0.1, 14, 9);
    a.scale(1.15, 1.0, 0.45);
    blobParts.push(a);
    const b = new THREE.SphereGeometry(0.075, 12, 8);
    b.scale(1.0, 0.95, 0.55);
    b.translate(0.06, 0.04, 0.03);
    blobParts.push(b);
    const c = new THREE.SphereGeometry(0.06, 12, 8);
    c.scale(1, 1, 0.6);
    c.translate(-0.06, 0.03, 0.035);
    blobParts.push(c);
    // kıvrık tepe
    const tip = tube(
      [
        new THREE.Vector3(0, 0, 0.05),
        new THREE.Vector3(0.01, 0.01, 0.09),
        new THREE.Vector3(0.03, 0.0, 0.12),
        new THREE.Vector3(0.045, -0.025, 0.115),
      ],
      0.022,
      10,
      7,
    );
    blobParts.push(tip);
  }
  const blobGeo = mergeAll(blobParts);
  const blobMat = clay(PAL.white, { rough: 0.38, emissive: 0.1 });
  type Blob = { x: number; y: number; col: string; s: number; rz: number };
  const blobs: Blob[] = [
    { x: -0.72, y: 0.3, col: PAL.coral, s: 1.0, rz: 0.3 },
    { x: -0.42, y: 0.58, col: PAL.butter, s: 1.05, rz: 1.2 },
    { x: -0.02, y: 0.66, col: PAL.leaf, s: 0.95, rz: -0.4 },
    { x: 0.38, y: 0.58, col: PAL.sky, s: 1.0, rz: 2.0 },
    { x: 0.82, y: 0.32, col: PAL.pink, s: 0.85, rz: 0.8 },
    { x: -0.74, y: -0.47, col: PAL.lilac, s: 0.95, rz: -1.0 },
    { x: -0.42, y: -0.67, col: PAL.periwinkle, s: 1.05, rz: 2.6 },
    { x: 0.0, y: -0.7, col: PAL.mint, s: 0.9, rz: -2.2 },
    { x: 0.38, y: -0.62, col: PAL.apricot, s: 0.85, rz: 0.4 },
  ];
  const NB = blobs.length;
  const blobIM = new THREE.InstancedMesh(blobGeo, blobMat, NB);
  blobs.forEach((b, i) => blobIM.setColorAt(i, _c.set(b.col)));
  pal.add(blobIM);
  const blobSquash = new Float32Array(NB);

  // ---------- damlalar ----------
  group.updateMatrixWorld(true);
  const toGroup = (x: number, y: number, z: number) => pal.localToWorld(new THREE.Vector3(x, y, z));
  // damla kaynakları: alt kenardaki yığınların altı
  const dripSrc: { blob: number; ox: number }[] = [
    { blob: 5, ox: -0.86 },
    { blob: 6, ox: -0.42 },
    { blob: 7, ox: 0.02 },
    { blob: 8, ox: 0.42 },
    { blob: 0, ox: -0.98 },
  ];
  // dış hattaki en yakın noktayı bul
  const nearestOutline = (x: number, below: boolean) => {
    let best = opts[0];
    let bd = 1e9;
    for (const p of opts) {
      if (below && p.y > 0.1) continue;
      if (!below && p.x > -0.6) continue;
      const d = Math.abs(p.x - x) + (below ? -p.y * 0.01 : Math.abs(p.y - 0.05));
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };
  type Drip = {
    anchor: THREE.Vector3;
    col: THREE.Color;
    period: number;
    off: number;
    fallY: number;
    fallX: number;
    fallZ: number;
    detached: boolean;
    lastU: number;
    lastCy: number;
  };
  const drips: Drip[] = [];
  const runnerGeos: THREE.BufferGeometry[] = [];
  const runnerCols: THREE.Color[] = [];
  dripSrc.forEach((d, i) => {
    const b = blobs[d.blob];
    const e = nearestOutline(d.ox, i < 4);
    const len = Math.hypot(e.x, e.y);
    const nx = e.x / len;
    const ny = e.y / len;
    const pts = [
      toGroup(b.x, b.y, faceZ + 0.02),
      toGroup(THREE.MathUtils.lerp(b.x, e.x, 0.6), THREE.MathUtils.lerp(b.y, e.y, 0.6), faceZ + 0.012),
      toGroup(e.x, e.y, faceZ - 0.005),
      toGroup(e.x + nx * 0.05, e.y + ny * 0.05, faceZ - BV),
      toGroup(e.x + nx * 0.065, e.y + ny * 0.065, 0),
    ];
    const anchor = pts[4].clone();
    anchor.y -= 0.02;
    pts.push(anchor.clone());
    runnerGeos.push(tube(pts, 0.032, 24, 7));
    const bead = new THREE.SphereGeometry(0.042, 10, 8);
    bead.translate(anchor.x, anchor.y, anchor.z);
    runnerGeos.push(bead);
    const col = new THREE.Color(b.col);
    runnerCols.push(col, col);
    drips.push({
      anchor,
      col,
      period: rand(3.0, 4.4),
      off: rand(0, 4),
      fallY: 0,
      fallX: 0,
      fallZ: 0,
      detached: false,
      lastU: 0,
      lastCy: 0,
    });
  });
  // boya akıntıları: köşe renkleriyle tek ağ
  {
    const list = runnerGeos.map(prep);
    list.forEach((g, i) => {
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) {
        arr[k * 3] = runnerCols[i].r;
        arr[k * 3 + 1] = runnerCols[i].g;
        arr[k * 3 + 2] = runnerCols[i].b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    });
    const runnerMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.38,
      bumpMap: clayBump(),
      bumpScale: 0.3,
    });
    group.add(new THREE.Mesh(mergeGeometries(list, false)!, runnerMat));
    list.forEach((g) => g.dispose());
  }
  const ND = drips.length;
  const DS = 1.45; // damla boyut çarpanı
  const dropMat = clay(PAL.white, { rough: 0.35, emissive: 0.1 });
  const drops = new THREE.InstancedMesh(teardrop(14), dropMat, ND * 2); // [0..ND) sarkan, [ND..2ND) düşen
  const necks = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), dropMat, ND);
  drips.forEach((d, i) => {
    drops.setColorAt(i, d.col);
    drops.setColorAt(ND + i, d.col);
    necks.setColorAt(i, d.col);
  });
  [drops, necks].forEach((m) => {
    m.frustumCulled = false;
    group.add(m);
  });

  // ---------- girdaplı halka ----------
  const ringG = new THREE.Group();
  ringG.rotation.set(0.15, 0, -0.16);
  ringG.position.y = 0.1;
  group.add(ringG);
  const R0 = 1.32;
  const R1 = 1.62;
  const RM = (R0 + R1) / 2;
  const ringGeo = new THREE.RingGeometry(R0, R1, 120, 2);
  // UV: halka dokusu 196..256 px aralığında: dış yarıçap = 256 px
  {
    const pos = ringGeo.attributes.position;
    const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, y);
      const k = (196 + ((r - R0) / (R1 - R0)) * 60) / 256 / r;
      uv.setXY(i, 0.5 + (x * k) / 2, 0.5 + (y * k) / 2);
    }
  }
  ringGeo.rotateX(-Math.PI / 2);
  const palettes = [
    ['#4A63C4', '#7C9BEA', '#B3CDF7', '#F7C548', '#FFF6DC'],
    ['#E66A86', '#F28AC0', '#F9A65A', '#F7D35C', '#FFF4E6'],
    ['#3EA597', '#4FC7B8', '#9BE0A0', '#C3A6FA', '#FFFFFF'],
  ];
  const swirlTex = palettes.map((p) => {
    const tx = swirlTexture(p);
    tx.center.set(0.5, 0.5);
    return tx;
  });
  const ringMat = (tx: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map: tx,
      emissiveMap: tx,
      emissive: '#ffffff',
      emissiveIntensity: 0.12,
      roughness: 0.7,
      side: THREE.DoubleSide,
      bumpMap: clayBump(),
      bumpScale: 0.8,
    });
  let curTex = 0;
  const oldMat = ringMat(swirlTex[0]);
  const ringOld = new THREE.Mesh(ringGeo, oldMat);
  ringG.add(ringOld);
  // yeniden boyama: konik alfa ile fırçanın arkasında açılan yeni halka
  const revealTex = canvasTexture(256, 256, (x, w) => {
    const c = w / 2;
    for (let a = 0; a < 360; a++) {
      const v = Math.round(255 * (1 - a / 360));
      x.fillStyle = `rgb(${v},${v},${v})`;
      x.beginPath();
      x.moveTo(c, c);
      x.arc(c, c, w, (a * Math.PI) / 180 - 0.004, ((a + 1) * Math.PI) / 180 + 0.004);
      x.fill();
    }
  });
  revealTex.colorSpace = THREE.NoColorSpace;
  revealTex.center.set(0.5, 0.5);
  const newMat = ringMat(swirlTex[1]);
  newMat.alphaMap = revealTex;
  newMat.alphaTest = 0.999;
  newMat.polygonOffset = true;
  newMat.polygonOffsetFactor = -2;
  newMat.polygonOffsetUnits = -2;
  const ringNew = new THREE.Mesh(ringGeo, newMat);
  ringNew.position.y = 0.003;
  ringNew.visible = false;
  ringG.add(ringNew);

  // ---------- fırça (kuyruklu yıldız) ----------
  const brush = new THREE.Group(); // uç orijinde, sap +y boyunca
  const brushInner = new THREE.Group();
  brush.add(brushInner);
  brushInner.scale.setScalar(0.85);
  const BM = new Merger();
  BM.add(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.034, 0.22),
        new THREE.Vector2(0.042, 0.3),
        new THREE.Vector2(0.038, 0.5),
        new THREE.Vector2(0.026, 0.72),
        new THREE.Vector2(0.02, 0.8),
        new THREE.Vector2(0.001, 0.82),
      ],
      12,
    ),
    clay('#C98A5E'),
  );
  BM.add(new THREE.CylinderGeometry(0.03, 0.022, 0.06, 12), clay(PAL.coral), [0, 0.77, 0]);
  BM.add(new THREE.CylinderGeometry(0.036, 0.04, 0.1, 14), clay(PAL.steel, { rough: 0.4 }), [0, 0.18, 0]);
  BM.add(
    new THREE.TorusGeometry(0.039, 0.007, 6, 16),
    clay(PAL.steel, { rough: 0.4 }),
    [0, 0.2, 0],
    [Math.PI / 2, 0, 0],
  );
  BM.add(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.001, 0.0),
        new THREE.Vector2(0.025, 0.035),
        new THREE.Vector2(0.042, 0.08),
        new THREE.Vector2(0.04, 0.14),
      ],
      12,
    ),
    clay('#F3E2C4'),
    [0, 0, 0],
  );
  BM.build(brushInner);
  const tipMat = new THREE.MeshStandardMaterial({
    color: palettes[1][0],
    roughness: 0.38,
    bumpMap: clayBump(),
    bumpScale: 0.4,
  });
  const tip = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.001, -0.004),
        new THREE.Vector2(0.024, 0.03),
        new THREE.Vector2(0.034, 0.06),
        new THREE.Vector2(0.03, 0.075),
      ],
      12,
    ),
    tipMat,
  );
  brushInner.add(tip);
  ringG.add(brush);

  // fırçanın bıraktığı yıldız pırıltıları
  const starShape = new THREE.Shape();
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const r = k % 2 ? 0.018 : 0.055;
    if (k) starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const NSP = 16;
  const sparkMat = glow('#FFE38A', 1, false);
  const sparks = new THREE.InstancedMesh(new THREE.ShapeGeometry(starShape), sparkMat, NSP);
  sparks.frustumCulled = false;
  ringG.add(sparks);
  const spAge = new Float32Array(NSP).fill(9);
  const spAng = new Float32Array(NSP);
  const spRad = new Float32Array(NSP);
  let spNext = 0;

  // sıçrama damlacıkları
  const NSPL = 26;
  const splash = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    clay(PAL.white, { rough: 0.35, emissive: 0.15 }),
    NSPL,
  );
  splash.frustumCulled = false;
  group.add(splash);
  const splP = Array.from({ length: NSPL }, () => new THREE.Vector3());
  const splV = Array.from({ length: NSPL }, () => new THREE.Vector3());
  const splAge = new Float32Array(NSPL).fill(9);
  const splCols = [PAL.coral, PAL.butter, PAL.mint, PAL.sky, PAL.lilac, PAL.pink, PAL.apricot, PAL.leaf].map(
    (c) => new THREE.Color(c),
  );
  for (let i = 0; i < NSPL; i++) splash.setColorAt(i, splCols[i % splCols.length]);

  // poke için: daldırılacak yığın ve halka koordinatlarındaki konumu
  const dipBlob = [3, 1, 4, 2, 0];
  let dipK = 0;
  const blobInRing = (i: number, lift: number) => {
    const b = blobs[i];
    const w = pal.localToWorld(new THREE.Vector3(b.x, b.y, faceZ + 0.06 + lift));
    return ringG.worldToLocal(w);
  };
  const dipTargets = dipBlob.map((i) => ({
    low: blobInRing(i, 0.0),
    high: blobInRing(i, 0.35),
    w: pal.localToWorld(new THREE.Vector3(blobs[i].x, blobs[i].y, faceZ + 0.08)),
  }));
  const upInRing = new THREE.Vector3(0.25, 1, 0.45).normalize().applyQuaternion(ringG.quaternion.clone().invert());
  const yAxis = new THREE.Vector3(0, 1, 0);

  const camQ = new THREE.Quaternion();
  const brushPos = new THREE.Vector3();
  const brushDir = new THREE.Vector3();
  const ringPos = new THREE.Vector3();
  const ringDir = new THREE.Vector3();

  const ringPoint = (phi: number, out: THREE.Vector3) => out.set(RM * Math.cos(phi), 0.012, RM * Math.sin(phi));
  /** Halkadaki fırça yönü: sap yukarı + geriye doğru eğik. */
  const ringBrushDir = (phi: number, out: THREE.Vector3) => {
    // hareket yönü (phi artarken): (-sin, 0, cos)
    out.set(Math.sin(phi) * 0.75 + Math.cos(phi) * 0.25, 0.8, -Math.cos(phi) * 0.75 + Math.sin(phi) * 0.25);
    return out.normalize();
  };

  // ---------- durum ----------
  const pokeShot = new OneShot(3.0);
  let phi = 0.5;
  let flow = 0;
  let splashed = false;
  let phiStart = 0;
  let lapStart = 0;
  let lapping = false;
  let wobble = 0;
  let nextSpark = 0;

  const spawnSpark = (ang: number) => {
    spAge[spNext] = 0;
    spAng[spNext] = ang + rand(-0.04, 0.0);
    spRad[spNext] = RM + rand(-0.12, 0.12);
    spNext = (spNext + 1) % NSP;
  };

  return {
    group,
    poke() {
      if (pokeShot.on) return;
      pokeShot.start();
      splashed = false;
      lapping = false;
      phiStart = phi;
      dipK = (dipK + 1) % dipBlob.length;
      tipMat.color.set(blobs[dipBlob[dipK]].col);
    },
    update(s) {
      const dt = s.dt;
      const t = s.t;
      const h = s.hover;
      const calm = s.reduce ? 0.25 : 1;

      // --- fırça: halkada dolaşır ya da poke'ta yığına dalar ---
      const pp = pokeShot.tick(dt);
      const target = dipTargets[dipK];
      let onRing = true;
      if (pp >= 0) {
        if (pp < 0.42) {
          onRing = false;
          // 0-0.18: yığına uç; 0.18-0.3: daldır; 0.3-0.42: halkaya dön
          ringPoint(phiStart, ringPos);
          ringBrushDir(phiStart, ringDir);
          if (pp < 0.18) {
            const k = ease.inOut(pp / 0.18);
            brushPos.lerpVectors(ringPos, target.high, k);
            brushPos.y += Math.sin(k * Math.PI) * 0.25;
            brushDir.lerpVectors(ringDir, upInRing, k).normalize();
          } else if (pp < 0.3) {
            const k = (pp - 0.18) / 0.12;
            const dip = Math.sin(Math.min(1, k * 1.6) * Math.PI);
            brushPos.lerpVectors(target.high, target.low, dip);
            brushDir.copy(upInRing);
            const bi = dipBlob[dipK];
            blobSquash[bi] = Math.max(blobSquash[bi], dip);
            if (k > 0.35 && !splashed) {
              splashed = true;
              wobble = 1;
              for (let i = 0; i < NSPL; i++) {
                splAge[i] = 0;
                splP[i].copy(target.w);
                const a = (i / NSPL) * Math.PI * 2 + rand(-0.2, 0.2);
                const sp = rand(0.7, 1.3);
                splV[i].set(Math.cos(a) * sp, Math.sin(a) * sp * 0.8 + 0.6, rand(0.3, 0.9));
                splash.setColorAt(i, i % 3 === 0 ? _c.set(blobs[bi].col) : splCols[(i + dipK) % splCols.length]);
              }
              if (splash.instanceColor) splash.instanceColor.needsUpdate = true;
            }
          } else {
            const k = ease.inOut((pp - 0.3) / 0.12);
            brushPos.lerpVectors(target.high, ringPos, k);
            brushDir.lerpVectors(upInRing, ringDir, k).normalize();
            phi = phiStart;
          }
        } else {
          // tam tur: arkasında yeni renkli halka açılır
          if (!lapping) {
            lapping = true;
            lapStart = phiStart;
            const next = (curTex + 1) % swirlTex.length;
            newMat.map = swirlTex[next];
            newMat.emissiveMap = swirlTex[next];
            newMat.needsUpdate = false;
            ringNew.visible = true;
            ringNew.rotation.y = -lapStart;
          }
          const k = Math.min(1, (pp - 0.42) / 0.5);
          const lap = ease.inOut(k);
          phi = lapStart + lap * Math.PI * 2;
          newMat.alphaTest = THREE.MathUtils.clamp(1 - lap, 0.002, 0.999);
          if (k >= 1 && ringNew.visible) {
            curTex = (curTex + 1) % swirlTex.length;
            oldMat.map = swirlTex[curTex];
            oldMat.emissiveMap = swirlTex[curTex];
            ringNew.visible = false;
          }
          if (Math.random() < 0.7) spawnSpark(phi);
        }
      }
      if (!pokeShot.on && ringNew.visible) {
        // güvenlik: yarıda kalmışsa tamamla
        curTex = (curTex + 1) % swirlTex.length;
        oldMat.map = swirlTex[curTex];
        oldMat.emissiveMap = swirlTex[curTex];
        ringNew.visible = false;
      }
      if (onRing) {
        if (!pokeShot.on) phi += dt * (0.42 + 0.45 * h) * calm;
        ringPoint(phi, brushPos);
        brushPos.y += Math.sin(t * 3.2) * 0.012 * calm;
        ringBrushDir(phi, brushDir);
        nextSpark -= dt * (1 + 2 * h) * calm;
        if (nextSpark <= 0) {
          spawnSpark(phi);
          nextSpark = 0.18;
        }
      }
      brush.position.copy(brushPos);
      brush.quaternion.setFromUnitVectors(yAxis, brushDir);
      // fırça kılları boyarken hafifçe kıvrılır
      brushInner.rotation.z = Math.sin(t * 6) * 0.06 * calm;

      // --- girdaplar yavaşça akar ---
      flow += dt * (0.05 + 0.08 * h) * calm;
      for (const tx of swirlTex) tx.rotation = flow;
      ringNew.rotation.y = lapping ? -lapStart : ringNew.rotation.y;
      const ei = 0.12 + 0.35 * s.night + 0.08 * h;
      oldMat.emissiveIntensity = ei;
      newMat.emissiveIntensity = ei;

      // --- pırıltılar ---
      ringG.getWorldQuaternion(camQ);
      camQ.invert().multiply(s.camera.quaternion);
      for (let i = 0; i < NSP; i++) {
        if (spAge[i] < 1.4) {
          spAge[i] += dt;
          const a = spAge[i] / 1.4;
          const sc = Math.sin(Math.PI * Math.min(1, a * 1.4)) * (1 - a) * 1.6 * (0.8 + 0.4 * Math.sin(t * 20 + i));
          _p.set(spRad[i] * Math.cos(spAng[i]), 0.05 + a * 0.08, spRad[i] * Math.sin(spAng[i]));
          _q.copy(camQ);
          _m.compose(_p, _q, _s.setScalar(Math.max(0.0001, sc)));
        } else _m.makeScale(0, 0, 0);
        sparks.setMatrixAt(i, _m);
      }
      sparks.instanceMatrix.needsUpdate = true;
      sparkMat.color.setRGB(1, 0.85 + 0.1 * s.night, 0.45 + 0.2 * s.night);

      // --- boya yığınları: nefes alır, daldırılınca ezilir ---
      for (let i = 0; i < NB; i++) {
        const b = blobs[i];
        blobSquash[i] = damp(blobSquash[i], 0, 3.5, dt);
        const sq = blobSquash[i];
        const breath = Math.sin(t * (1.6 + i * 0.13) + i * 1.7) * (0.05 + 0.06 * h) * calm;
        const sz = b.s * (1 + breath - sq * 0.55);
        const sxy = b.s * (1 - breath * 0.4 + sq * 0.35);
        _m.compose(
          _p.set(b.x, b.y, faceZ - 0.01),
          _q.setFromEuler(_e.set(0, 0, b.rz + Math.sin(t * 0.7 + i) * 0.05 * calm)),
          _s.set(sxy, sxy, sz),
        );
        blobIM.setMatrixAt(i, _m);
      }
      blobIM.instanceMatrix.needsUpdate = true;

      // --- damlalar: büyü → uza → kop → düş ---
      const rate = (1 + 0.7 * h) * (s.reduce ? 0.35 : 1);
      for (let i = 0; i < ND; i++) {
        const d = drips[i];
        const P = d.period;
        const u = ((((t * rate + d.off) % P) + P) % P) / P;
        let r: number;
        let Lh: number;
        let st: number;
        let rn: number;
        if (u < 0.6) {
          const k = ease.out(u / 0.6);
          r = 0.022 + 0.042 * k;
          Lh = 0.015 + 0.07 * k;
          st = 1.05 + 0.25 * k;
          rn = 0.016 + 0.006 * k;
        } else if (u < 0.74) {
          const k = (u - 0.6) / 0.14;
          r = 0.064 - 0.004 * k;
          Lh = 0.085 + 0.12 * k * k;
          st = 1.3 + 0.55 * k;
          rn = 0.022 * (1 - k) + 0.004;
        } else {
          const k = (u - 0.74) / 0.26;
          r = 0.022 * smooth(0, 1, k) + 0.004;
          Lh = 0.015 * k;
          st = 1.05;
          rn = 0.016 * k + 0.002;
        }
        r *= DS;
        Lh *= DS;
        rn *= DS;
        // kopma anı: düşen damla, sarkanın son konumundan başlar
        if (u >= 0.74 && d.lastU < 0.74) {
          d.detached = true;
          d.fallX = d.anchor.x;
          d.fallZ = d.anchor.z;
          d.fallY = d.lastCy;
        }
        d.lastU = u;
        const ax = d.anchor.x;
        const ay = d.anchor.y;
        const az = d.anchor.z;
        const sway = Math.sin(t * 1.7 + i) * 0.006 * calm;
        // boyun
        _m.compose(_p.set(ax + sway * 0.5, ay - Lh / 2, az), _q.identity(), _s.set(rn, Math.max(0.001, Lh + 0.01), rn));
        necks.setMatrixAt(i, _m);
        // sarkan damla
        const cy = ay - Lh - r * st * 0.92;
        d.lastCy = cy;
        _m.compose(_p.set(ax + sway, cy, az), _q.identity(), _s.set(r, r * st, r));
        drops.setMatrixAt(i, _m);
        // düşen damla
        if (d.detached) {
          const tau = u >= 0.74 ? ((u - 0.74) * P) / rate : 9;
          const fall = 0.5 * 2.4 * tau * tau;
          const life = smooth(0.85, 0.45, fall);
          if (life <= 0 || tau > 5) {
            d.detached = false;
            _m.makeScale(0, 0, 0);
          } else {
            const rr = 0.06 * DS * life;
            const stf = 1 + 0.8 * Math.exp(-tau * 6);
            _m.compose(
              _p.set(d.fallX, d.fallY - fall, d.fallZ + tau * 0.05),
              _q.identity(),
              _s.set(rr / Math.sqrt(stf), rr * stf, rr / Math.sqrt(stf)),
            );
          }
        } else _m.makeScale(0, 0, 0);
        drops.setMatrixAt(ND + i, _m);
      }
      drops.instanceMatrix.needsUpdate = true;
      necks.instanceMatrix.needsUpdate = true;

      // --- sıçrama ---
      let anySpl = false;
      for (let i = 0; i < NSPL; i++) {
        if (splAge[i] < 1.3) {
          anySpl = true;
          splAge[i] += dt;
          splV[i].y -= 1.6 * dt;
          splP[i].addScaledVector(splV[i], dt);
          splV[i].multiplyScalar(Math.exp(-dt * 1.2));
          _v.copy(splP[i]);
          const len = _v.length();
          if (len > 1.85) _v.multiplyScalar(1.85 / len);
          const a = splAge[i] / 1.3;
          const sc = (0.6 + (i % 4) * 0.25) * (a < 0.1 ? a / 0.1 : 1 - smooth(0.6, 1, a));
          _m.compose(_v, _q.identity(), _s.setScalar(Math.max(0.0001, sc)));
        } else _m.makeScale(0, 0, 0);
        splash.setMatrixAt(i, _m);
      }
      if (anySpl || pp >= 0) splash.instanceMatrix.needsUpdate = true;

      // --- gezegen salınımı ---
      wobble = damp(wobble, 0, 2.5, dt);
      const wj = wobble * Math.sin(t * 18);
      pal.scale.set(1 + wj * 0.04, 1 - wj * 0.04, 1);
      group.position.y = Math.sin(t * 0.8) * 0.04 * calm;
      group.rotation.y = Math.sin(t * 0.3) * 0.12 * calm;
      group.rotation.z = Math.sin(t * 0.5) * 0.02 * calm;
    },
  };
}
