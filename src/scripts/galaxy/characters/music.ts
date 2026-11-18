import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, clay, damp, ease, glow, OneShot, PAL, rbox, smooth, tube, type Character } from './kit';

/**
 * Müzik: elektro gitar (Strat) biçiminde gezegen.
 * Gövde + pena koruyucu + 3 manyetik + düğmeler + köprü + tremolo kolu, sap + perdeler, 6 burgulu kafa.
 * Teller köprüden eşiğe, oradan burgulara gider ve tıngırdatılınca dalgalanır.
 * Jak kablosu gezegenin etrafını halka gibi sarıp minik amfiye bağlanır; plak uydu döner, notalar uçuşur.
 */

// ---------- küçük yardımcılar (sadece bu dosya) ----------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
type V3 = [number, number, number];

/** Aynı malzemeli statik parçaları tek çizim çağrısında birleştirir. */
class Merger {
  private parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  add(geo: THREE.BufferGeometry, mat: THREE.Material, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scl: V3 = [1, 1, 1]) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes))
      if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    g.clearGroups();
    _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl));
    g.applyMatrix4(_m);
    if (!g.attributes.uv)
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const list = this.parts.get(mat) ?? [];
    list.push(g);
    this.parts.set(mat, list);
    geo.dispose();
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

/** Kapalı yumuşak eğriden 2B şekil. */
function smoothShape(pts: [number, number][], n = 120) {
  const c = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    true,
    'centripetal',
  );
  return new THREE.Shape(c.getPoints(n).map((p) => new THREE.Vector2(p.x, p.y)));
}

function extrude(shape: THREE.Shape, depth: number, bevel: number, bevelSize = bevel, segs = 3, curve = 12) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize,
    bevelSegments: segs,
    curveSegments: curve,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function create(): Character {
  const group = new THREE.Group();
  const gtr = new THREE.Group(); // eğik duran gitar
  gtr.rotation.z = -0.3;
  group.add(gtr);
  const g = new THREE.Group(); // gitar koordinatları: gövde altı y≈-1.2, kafa üstü y≈1.85
  g.position.y = -0.27;
  gtr.add(g);

  const M = new Merger();
  const mBody = clay(PAL.coral);
  const mGuard = clay(PAL.cream);
  const mPly = clay(PAL.mint);
  const mMaple = clay('#F4D49E');
  const mBoard = clay('#B9785A');
  const mSteel = clay(PAL.steel, { rough: 0.45 });
  const mPickup = clay(PAL.mint);
  const mKnobTop = clay(PAL.butter);
  const mInk = clay(PAL.ink);
  const mWhite = clay(PAL.white);

  // ---------- gövde ----------
  const bodyPts: [number, number][] = [
    [0, -1.2],
    [0.42, -1.15],
    [0.68, -0.96],
    [0.77, -0.66],
    [0.68, -0.38],
    [0.6, -0.16],
    [0.64, 0.1],
    [0.6, 0.34],
    [0.52, 0.44],
    [0.43, 0.38],
    [0.34, 0.2],
    [0.24, 0.07],
    [0.13, 0.03],
    [-0.13, 0.05],
    [-0.21, 0.16],
    [-0.28, 0.4],
    [-0.36, 0.62],
    [-0.47, 0.72],
    [-0.6, 0.64],
    [-0.66, 0.38],
    [-0.62, 0.06],
    [-0.7, -0.3],
    [-0.77, -0.66],
    [-0.68, -0.98],
    [-0.4, -1.16],
  ];
  M.add(extrude(smoothShape(bodyPts, 110), 0.26, 0.08, 0.07, 3, 110), mBody);

  // sırttaki çıkartmalar: yıldız, kalp, şimşek
  const star = new THREE.Shape();
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + Math.PI / 2;
    const r = k % 2 ? 0.05 : 0.12;
    if (k) star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.09);
  heart.bezierCurveTo(0.05, -0.04, 0.11, 0.0, 0.1, 0.05);
  heart.bezierCurveTo(0.09, 0.1, 0.02, 0.1, 0, 0.05);
  heart.bezierCurveTo(-0.02, 0.1, -0.09, 0.1, -0.1, 0.05);
  heart.bezierCurveTo(-0.11, 0.0, -0.05, -0.04, 0, -0.09);
  // ön yüzde açık tonlu "sunburst" iç alan (kenarlar koyu kalır)
  const inner = smoothShape(
    bodyPts.map(([x, y]) => [x * 0.86, -0.45 + (y + 0.45) * 0.88] as [number, number]),
    110,
  );
  M.add(extrude(inner, 0.004, 0.006, 0.02, 2, 110), clay('#F89A8E'), [0, 0, 0.21]);
  // küçük çıkartmalar: alt göbekte yıldız, üst boynuzda nota
  M.add(extrude(star, 0.006, 0.006, 0.006, 2, 4), mKnobTop, [-0.5, -0.78, 0.222], [0, 0, -0.2], [0.55, 0.55, 1]);
  M.add(extrude(star, 0.006, 0.006, 0.006, 2, 4), clay(PAL.white), [-0.6, -0.55, 0.222], [0, 0, 0.3], [0.3, 0.3, 1]);
  M.add(extrude(heart, 0.006, 0.006, 0.006, 2, 8), clay(PAL.pink), [-0.46, 0.48, 0.222], [0, 0, 0.35], [0.5, 0.5, 1]);
  // pena koruyucu (krem) + altında nane rengi kat
  const guard = smoothShape(
    [
      [-0.13, 0.03],
      [-0.24, 0.14],
      [-0.36, 0.06],
      [-0.4, -0.2],
      [-0.33, -0.46],
      [-0.22, -0.64],
      [-0.19, -0.75],
      [0.0, -0.73],
      [0.19, -0.75],
      [0.28, -0.92],
      [0.44, -0.96],
      [0.56, -0.8],
      [0.53, -0.52],
      [0.38, -0.3],
      [0.3, -0.06],
      [0.16, 0.02],
    ],
    90,
  );
  M.add(extrude(guard, 0.006, 0.004, 0.026, 2, 90), mPly, [0, 0, 0.214]);
  M.add(extrude(guard, 0.01, 0.006, 0.006, 2, 90), mGuard, [0, 0, 0.226]);

  // sırt: sap plakası + tremolo kapağı
  M.add(rbox(0.18, 0.22, 0.02, 0.02, 2), mSteel, [0, -0.16, -0.215]);
  M.add(rbox(0.26, 0.36, 0.02, 0.04, 2), mGuard, [0, -0.72, -0.215]);
  // vidalar: sap plakasında 4, tremolo kapağında 6; kapakta 6 tel deliği
  const screw = (x: number, y: number) =>
    M.add(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 8), mSteel, [x, y, -0.229], [Math.PI / 2, 0, 0]);
  for (const sx of [-0.06, 0.06]) for (const sy of [-0.08, 0.08]) screw(sx, -0.16 + sy);
  for (const sx of [-0.1, 0.1]) for (const sy of [-0.15, 0, 0.15]) screw(sx, -0.72 + sy);
  for (let i = 0; i < 6; i++)
    M.add(new THREE.SphereGeometry(0.012, 8, 6), mInk, [(i - 2.5) * 0.03, -0.62, -0.226], [0, 0, 0], [1, 1.6, 0.4]);
  for (let i = 0; i < 3; i++) M.add(rbox(0.13, 0.016, 0.01, 0.005, 2), mInk, [0, -0.74 - i * 0.04, -0.226]);
  // yuvarlak "plak" çıkartması
  M.add(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 24), mInk, [-0.38, -0.2, -0.218], [Math.PI / 2, 0, 0]);
  M.add(
    new THREE.CylinderGeometry(0.04, 0.04, 0.01, 18),
    clay(PAL.apricot),
    [-0.38, -0.2, -0.222],
    [Math.PI / 2, 0, 0],
  );
  M.add(
    new THREE.CylinderGeometry(0.06, 0.06, 0.008, 18),
    clay(PAL.leaf),
    [0.42, -0.92, -0.218],
    [Math.PI / 2, 0, 0],
    [1, 1, 1],
  );
  M.add(extrude(star, 0.01, 0.008, 0.008, 2, 4), mKnobTop, [0.4, -0.3, -0.222], [0, Math.PI, 0.3]);
  M.add(extrude(heart, 0.01, 0.008, 0.008, 2, 8), clay(PAL.pink), [-0.42, -0.62, -0.222], [0, Math.PI, -0.25]);
  const bolt = new THREE.Shape([
    new THREE.Vector2(0.02, 0.12),
    new THREE.Vector2(-0.06, -0.01),
    new THREE.Vector2(0.0, -0.01),
    new THREE.Vector2(-0.03, -0.12),
    new THREE.Vector2(0.06, 0.02),
    new THREE.Vector2(0.0, 0.02),
  ]);
  M.add(extrude(bolt, 0.01, 0.006, 0.006, 2, 2), clay(PAL.sky), [0.3, -0.95, -0.222], [0, Math.PI, 0.2]);
  // kayış düğmeleri
  M.add(new THREE.SphereGeometry(0.04, 12, 8), mWhite, [0, -1.27, 0]);
  M.add(new THREE.SphereGeometry(0.04, 12, 8), mWhite, [-0.6, 0.63, 0]);

  // ---------- sap ----------
  const nutY = 1.25;
  const bridgeY = -0.83;
  const neckW = (y: number) => 0.24 + ((0.2 - 0.24) * (y + 0.3)) / (nutY + 0.3);
  const neckShape = new THREE.Shape([
    new THREE.Vector2(-0.12, -0.32),
    new THREE.Vector2(0.12, -0.32),
    new THREE.Vector2(0.1, nutY + 0.02),
    new THREE.Vector2(-0.1, nutY + 0.02),
  ]);
  M.add(extrude(neckShape, 0.06, 0.03, 0.025, 3, 4), mMaple, [0, 0, 0.19]);
  const boardShape = new THREE.Shape([
    new THREE.Vector2(-0.118, -0.28),
    new THREE.Vector2(0.118, -0.28),
    new THREE.Vector2(0.099, nutY),
    new THREE.Vector2(-0.099, nutY),
  ]);
  M.add(extrude(boardShape, 0.02, 0.008, 0.004, 2, 4), mBoard, [0, 0, 0.262]);
  const boardTop = 0.282;
  // perdeler
  const L = nutY - bridgeY;
  const fretY: number[] = [];
  for (let n = 1; n <= 21; n++) fretY.push(nutY - L * (1 - Math.pow(2, -n / 12)));
  for (const y of fretY)
    M.add(
      new THREE.CylinderGeometry(0.007, 0.007, 1, 6, 1),
      mSteel,
      [0, y, boardTop],
      [0, 0, Math.PI / 2],
      [1, neckW(y) - 0.012, 1],
    );
  // perde noktaları
  const dotAt = (n: number, x = 0) => {
    const y = (fretY[n - 1] + (n > 1 ? fretY[n - 2] : nutY)) / 2;
    M.add(new THREE.CylinderGeometry(0.016, 0.016, 0.01, 12), mGuard, [x, y, boardTop], [Math.PI / 2, 0, 0]);
  };
  [3, 5, 7, 9, 15, 17, 19, 21].forEach((n) => dotAt(n));
  dotAt(12, -0.045);
  dotAt(12, 0.045);
  // eşik
  M.add(rbox(0.205, 0.03, 0.035, 0.01, 2), mGuard, [0, nutY + 0.005, 0.292]);

  // ---------- kafa ----------
  const head = smoothShape(
    [
      [0.1, 1.22],
      [0.125, 1.34],
      [0.1, 1.46],
      [0.07, 1.6],
      [0.07, 1.7],
      [0.02, 1.81],
      [-0.1, 1.87],
      [-0.21, 1.83],
      [-0.25, 1.72],
      [-0.22, 1.54],
      [-0.2, 1.38],
      [-0.12, 1.24],
    ],
    80,
  );
  M.add(extrude(head, 0.04, 0.022, 0.02, 3, 80), mMaple, [0, 0, 0.19]);
  const headTop = 0.232;
  const posts: THREE.Vector3[] = [];
  const btnCols = [PAL.coral, PAL.apricot, PAL.butter, PAL.leaf, PAL.sky, PAL.lilac];
  for (let k = 0; k < 6; k++) {
    const y = 1.37 + k * 0.074;
    const x = -0.07 - k * 0.012;
    posts.push(new THREE.Vector3(x, y, headTop + 0.045));
    M.add(new THREE.CylinderGeometry(0.014, 0.016, 0.06, 10), mSteel, [x, y, headTop + 0.03], [Math.PI / 2, 0, 0]);
    M.add(new THREE.CylinderGeometry(0.026, 0.026, 0.012, 14), mSteel, [x, y, headTop + 0.004], [Math.PI / 2, 0, 0]);
    // burgu mili + renkli kelebek (kafanın sol kenarından dışarı)
    const edge = -0.2 - (k > 3 ? (k - 3) * 0.02 : 0);
    M.add(new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6), mSteel, [edge - 0.03, y, 0.19], [0, 0, Math.PI / 2]);
    M.add(
      new THREE.SphereGeometry(0.042, 14, 10),
      clay(btnCols[k]),
      [edge - 0.1, y, 0.19],
      [0, 0, 0],
      [1.25, 0.8, 0.45],
    );
  }
  // tel yönlendirici
  M.add(rbox(0.06, 0.018, 0.018, 0.008, 2), mSteel, [0.005, 1.5, headTop + 0.03]);

  // ---------- manyetikler, köprü, düğmeler ----------
  const guardTop = 0.236;
  const strX = (i: number, y: number) => {
    const sp = 0.042 + ((0.03 - 0.042) * (y - bridgeY)) / L;
    return (i - 2.5) * sp;
  };
  const pickups: [number, number][] = [
    [-0.37, 0],
    [-0.52, 0],
    [-0.67, 0.16],
  ];
  for (const [y, rz] of pickups) {
    M.add(rbox(0.31, 0.075, 0.04, 0.03, 2), mPickup, [0, y, guardTop + 0.015], [0, 0, rz]);
    for (let i = 0; i < 6; i++) {
      const x = strX(i, y);
      M.add(
        new THREE.CylinderGeometry(0.011, 0.011, 0.012, 8),
        mSteel,
        [x, y + Math.sin(rz) * x, guardTop + 0.037],
        [Math.PI / 2, 0, 0],
      );
    }
  }
  // köprü plakası + eyerler
  M.add(rbox(0.32, 0.17, 0.02, 0.02, 2), mSteel, [0, bridgeY - 0.05, 0.228]);
  for (let i = 0; i < 6; i++)
    M.add(rbox(0.034, 0.07, 0.05, 0.012, 2), mSteel, [strX(i, bridgeY), bridgeY - 0.02, 0.255 + (i % 2) * 0.006]);
  // tremolo kolu
  M.add(
    tube(
      [
        new THREE.Vector3(0.15, -0.92, 0.25),
        new THREE.Vector3(0.2, -0.98, 0.29),
        new THREE.Vector3(0.26, -1.08, 0.3),
        new THREE.Vector3(0.3, -1.16, 0.3),
      ],
      0.011,
      16,
      6,
    ),
    mSteel,
  );
  M.add(new THREE.SphereGeometry(0.024, 10, 8), mWhite, [0.305, -1.17, 0.3], [0, 0, 0], [1, 1.5, 1]);
  // ses/ton düğmeleri
  const knobs: [number, number][] = [
    [0.26, -0.6],
    [0.36, -0.73],
    [0.45, -0.86],
  ];
  for (const [x, y] of knobs) {
    M.add(new THREE.CylinderGeometry(0.048, 0.054, 0.05, 18), mPickup, [x, y, guardTop + 0.025], [Math.PI / 2, 0, 0]);
    M.add(new THREE.CylinderGeometry(0.036, 0.04, 0.012, 16), mKnobTop, [x, y, guardTop + 0.055], [Math.PI / 2, 0, 0]);
    M.add(rbox(0.008, 0.03, 0.006, 0.003, 2), mInk, [x, y + 0.018, guardTop + 0.062]);
  }
  // 5 konumlu seçici
  M.add(rbox(0.024, 0.11, 0.008, 0.004, 2), mInk, [0.33, -0.42, guardTop + 0.004], [0, 0, 0.55]);
  M.add(rbox(0.03, 0.022, 0.05, 0.01, 2), mWhite, [0.325, -0.41, guardTop + 0.03], [0, 0, 0.55]);
  // jak plakası (futbol topu biçimli) + fiş
  const jack = new THREE.Vector3(0.52, -0.97, 0.21);
  M.add(new THREE.SphereGeometry(0.1, 18, 8), mSteel, [jack.x, jack.y, jack.z], [0, 0, 0.75], [1.15, 0.6, 0.12]);
  M.add(
    new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12),
    mSteel,
    [jack.x, jack.y, jack.z + 0.05],
    [Math.PI / 2, 0, 0],
  );
  M.add(new THREE.CylinderGeometry(0.04, 0.034, 0.16, 14), mInk, [jack.x, jack.y, jack.z + 0.17], [Math.PI / 2, 0, 0]);
  M.add(new THREE.TorusGeometry(0.038, 0.008, 6, 16), mKnobTop, [jack.x, jack.y, jack.z + 0.11]);
  M.build(g);

  // ---------- teller (köprü → eşik → burgu) ----------
  const NS = 6;
  const NV = 48; // titreşen halka sayısı
  const NH = 5; // eşik → burgu
  const R = NV + NH;
  const RV = 5;
  const strPos = new Float32Array(NS * R * RV * 3);
  const strNor = new Float32Array(NS * R * RV * 3);
  const strCol = new Float32Array(NS * R * RV * 3);
  const strIdx: number[] = [];
  const strCols = ['#FF8C82', '#FFB46E', '#FFD35C', '#9BE59F', '#7FD2F5', '#C6AEFF'].map((c) => new THREE.Color(c));
  const strR = [0.012, 0.0108, 0.0096, 0.0086, 0.0076, 0.0068];
  const bridgeP: THREE.Vector3[] = [];
  const nutP: THREE.Vector3[] = [];
  for (let i = 0; i < NS; i++) {
    bridgeP.push(new THREE.Vector3(strX(i, bridgeY), bridgeY, 0.3));
    nutP.push(new THREE.Vector3(strX(i, nutY), nutY + 0.01, 0.318));
    for (let r = 0; r < R; r++)
      for (let v = 0; v < RV; v++) {
        const a = (v / RV) * Math.PI * 2;
        const o = ((i * R + r) * RV + v) * 3;
        strNor[o] = Math.cos(a);
        strNor[o + 1] = 0;
        strNor[o + 2] = Math.sin(a);
        strCol[o] = strCols[i].r;
        strCol[o + 1] = strCols[i].g;
        strCol[o + 2] = strCols[i].b;
        if (r < R - 1) {
          const a0 = (i * R + r) * RV + v;
          const a1 = (i * R + r) * RV + ((v + 1) % RV);
          strIdx.push(a0, a0 + RV, a1, a1, a0 + RV, a1 + RV);
        }
      }
  }
  const strGeo = new THREE.BufferGeometry();
  const strPosAttr = new THREE.BufferAttribute(strPos, 3);
  strPosAttr.setUsage(THREE.DynamicDrawUsage);
  strGeo.setAttribute('position', strPosAttr);
  strGeo.setAttribute('normal', new THREE.BufferAttribute(strNor, 3));
  strGeo.setAttribute('color', new THREE.BufferAttribute(strCol, 3));
  strGeo.setIndex(strIdx);
  const strMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#ffffff' });
  const strings = new THREE.Mesh(strGeo, strMat);
  strings.frustumCulled = false;
  g.add(strings);
  const strAmp = new Float32Array(NS);
  const strPhase = new Float32Array(NS);
  const strFreq = [2.6, 3.0, 3.4, 3.9, 4.4, 5.0];
  function writeStrings(t: number, shimmer: number) {
    for (let i = 0; i < NS; i++) {
      const b = bridgeP[i];
      const n = nutP[i];
      const p = posts[i];
      const A = strAmp[i] + shimmer;
      const ph = strPhase[i];
      const rr = strR[i];
      for (let r = 0; r < R; r++) {
        let cx: number;
        let cy: number;
        let cz: number;
        if (r < NV) {
          const u = r / (NV - 1);
          cx = b.x + (n.x - b.x) * u;
          cy = b.y + (n.y - b.y) * u;
          cz = b.z + (n.z - b.z) * u;
          if (A > 0.0004) {
            const env = Math.sin(Math.PI * u);
            const d =
              A *
              env *
              (0.6 * Math.sin(Math.PI * 2 * strFreq[i] * t + ph) +
                0.55 * Math.sin(Math.PI * 2 * (3.2 * u - 1.8 * t) + ph));
            cx += d;
            cz += d * 0.25;
          }
        } else {
          const u = (r - NV + 1) / NH;
          cx = n.x + (p.x - n.x) * u;
          cy = n.y + (p.y - n.y) * u;
          cz = n.z + (p.z - n.z) * u;
        }
        for (let v = 0; v < RV; v++) {
          const o = ((i * R + r) * RV + v) * 3;
          strPos[o] = cx + strNor[o] * rr;
          strPos[o + 1] = cy;
          strPos[o + 2] = cz + strNor[o + 2] * rr;
        }
      }
    }
    strPosAttr.needsUpdate = true;
  }
  writeStrings(0, 0);

  // ---------- pena ----------
  const pickShape = smoothShape(
    [
      [0, -0.085],
      [0.05, -0.02],
      [0.075, 0.045],
      [0.04, 0.08],
      [0, 0.085],
      [-0.04, 0.08],
      [-0.075, 0.045],
      [-0.05, -0.02],
    ],
    40,
  );
  const pick = new THREE.Group();
  const pickMesh = new THREE.Mesh(extrude(pickShape, 0.012, 0.008, 0.008, 2, 40), clay(PAL.lilac));
  const pickStar = new THREE.Mesh(new THREE.CircleGeometry(0.022, 5), clay(PAL.butter, { emissive: 0.4 }));
  pickStar.position.set(0, 0.02, 0.016);
  pickMesh.add(pickStar);
  pick.add(pickMesh);
  g.add(pick);
  const pickRest = new THREE.Vector3(0.24, -0.44, 0.42);

  // ---------- kablo halkası + amfi ----------
  group.updateMatrixWorld(true);
  const plugEnd = g.localToWorld(new THREE.Vector3(jack.x, jack.y, jack.z + 0.25));
  const plugOut = g.localToWorld(new THREE.Vector3(jack.x - 0.05, jack.y - 0.12, jack.z + 0.5));
  const ringPt = (th: number) =>
    new THREE.Vector3(1.5 * Math.cos(th), -0.55 - 0.72 * Math.sin(th), 0.86 * Math.sin(th));
  const amp = new THREE.Group();
  amp.position.set(1.17, -1.18, -0.42);
  amp.rotation.set(0.12, 0.55, 0.04);
  group.add(amp);
  const ampIn = new THREE.Vector3(0.11, 0.13, -0.04);
  amp.updateMatrixWorld(true);
  const ampInW = amp.localToWorld(ampIn.clone());
  const cablePts: THREE.Vector3[] = [plugEnd, plugOut];
  for (let th = Math.PI / 2 + 0.55; th <= Math.PI * 2 + 0.25; th += 0.32) cablePts.push(ringPt(th));
  cablePts.push(
    new THREE.Vector3(1.38, -1.0, 0.3),
    new THREE.Vector3(1.2, -1.28, 0.32),
    ampInW.clone().add(new THREE.Vector3(0.02, 0.16, -0.02)),
    ampInW,
  );
  const cableCurve = new THREE.CatmullRomCurve3(cablePts, false, 'centripetal');
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 160, 0.027, 7, false), clay(PAL.periwinkle));
  group.add(cable);
  const CS = 300;
  const cableSamples: THREE.Vector3[] = cableCurve.getSpacedPoints(CS);

  // amfi gövdesi
  const AM = new Merger();
  const mTolex = clay('#6B4462');
  AM.add(rbox(0.4, 0.34, 0.22, 0.06, 3), mTolex);
  AM.add(rbox(0.34, 0.25, 0.02, 0.03, 2), mGuard, [0, -0.025, 0.105]);
  AM.add(rbox(0.36, 0.05, 0.02, 0.012, 2), mSteel, [0, 0.135, 0.1]);
  AM.add(
    tube(
      [
        new THREE.Vector3(-0.09, 0.17, 0),
        new THREE.Vector3(-0.06, 0.23, 0),
        new THREE.Vector3(0.06, 0.23, 0),
        new THREE.Vector3(0.09, 0.17, 0),
      ],
      0.016,
      16,
      6,
    ),
    mInk,
  );
  for (let k = 0; k < 4; k++)
    AM.add(
      new THREE.CylinderGeometry(0.014, 0.016, 0.02, 10),
      clay(PAL.coral),
      [-0.1 + k * 0.05, 0.135, 0.115],
      [Math.PI / 2, 0, 0],
    );
  AM.add(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 10), mSteel, [ampIn.x, ampIn.y, ampIn.z]);
  // köşe korumaları
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) AM.add(new THREE.SphereGeometry(0.03, 8, 6), mInk, [sx * 0.185, sy * 0.155, 0.095]);
  AM.add(new THREE.TorusGeometry(0.095, 0.012, 8, 28), mInk, [0, -0.025, 0.115]);
  AM.build(amp);
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.04, 28, 1, true),
    clay('#4A3346', { side: THREE.DoubleSide }),
  );
  cone.rotation.x = -Math.PI / 2;
  const coneG = new THREE.Group();
  coneG.position.set(0, -0.025, 0.1);
  coneG.add(cone);
  const dust = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), clay(PAL.butter));
  dust.rotation.x = Math.PI / 2;
  coneG.add(dust);
  amp.add(coneG);
  const ampLightMat = glow('#FF6F7A', 1, false);
  const ampLight = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), ampLightMat);
  ampLight.position.set(0.14, 0.135, 0.115);
  amp.add(ampLight);
  const haloMat = glow('#FF8A93', 0.0);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.05, 20), haloMat);
  halo.position.set(0.14, 0.135, 0.12);
  amp.add(halo);

  // amfiden çıkan ses halkaları
  const NRING = 3;
  const ringGeo = new THREE.TorusGeometry(0.1, 0.009, 6, 32);
  const ringHue = [PAL.pink, PAL.sky, PAL.butter];
  const ringMeshes: THREE.Mesh[] = [];
  const ringMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < NRING; i++) {
    const mat = glow(ringHue[i], 0, false);
    const rm = new THREE.Mesh(ringGeo, mat);
    rm.position.set(0, -0.025, 0.12);
    rm.visible = false;
    amp.add(rm);
    ringMeshes.push(rm);
    ringMats.push(mat);
  }
  const ringAge = new Float32Array(NRING).fill(9);
  let ringNext = 0;
  const fireRing = () => {
    ringAge[ringNext] = 0;
    ringNext = (ringNext + 1) % NRING;
  };

  // kablodaki sinyal ışıkları
  const NPULSE = 8;
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.034, 12, 8), glow('#FFFFFF', 0.95, false), NPULSE);
  pulses.frustumCulled = false;
  group.add(pulses);
  const pulseU = new Float32Array(NPULSE).fill(-1);
  const pulseSpd = new Float32Array(NPULSE);
  const pulseCols = [PAL.pink, PAL.butter, PAL.sky, PAL.mint, PAL.lilac, PAL.apricot].map((c) => new THREE.Color(c));
  for (let i = 0; i < NPULSE; i++) pulses.setColorAt(i, pulseCols[i % pulseCols.length]);
  let pulseNext = 0;
  const firePulse = (spd: number) => {
    pulseU[pulseNext] = 0;
    pulseSpd[pulseNext] = spd;
    pulseNext = (pulseNext + 1) % NPULSE;
  };
  const pendingPulse = new Float32Array(8).fill(-1);
  const queuePulse = (delay: number) => {
    for (let k = 0; k < pendingPulse.length; k++)
      if (pendingPulse[k] < 0) {
        pendingPulse[k] = delay;
        return;
      }
  };

  // ---------- plak uydu ----------
  const vinylTex = canvasTexture(256, 256, (x, w) => {
    const c = w / 2;
    x.fillStyle = '#2B2232';
    x.fillRect(0, 0, w, w);
    for (let r = c; r > 40; r -= 2.2) {
      x.strokeStyle = `rgba(255,255,255,${0.04 + 0.05 * Math.random()})`;
      x.lineWidth = 1;
      x.beginPath();
      x.arc(c, c, r, 0, Math.PI * 2);
      x.stroke();
    }
    x.strokeStyle = 'rgba(255,255,255,0.22)';
    x.lineWidth = 3;
    [90, 70].forEach((r) => {
      x.beginPath();
      x.arc(c, c, r, 0, Math.PI * 2);
      x.stroke();
    });
    x.strokeStyle = 'rgba(255,255,255,0.18)';
    x.lineWidth = 14;
    x.beginPath();
    x.arc(c, c, 100, -0.6, 0.1);
    x.stroke();
    x.beginPath();
    x.arc(c, c, 100, Math.PI - 0.6, Math.PI + 0.1);
    x.stroke();
    const seg = [PAL.coral, PAL.butter, PAL.mint, PAL.sky];
    seg.forEach((col, k) => {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(c, c);
      x.arc(c, c, 40, (k * Math.PI) / 2, ((k + 1) * Math.PI) / 2);
      x.fill();
    });
    x.fillStyle = PAL.cream;
    x.beginPath();
    x.arc(c, c, 14, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#2B2232';
    x.beginPath();
    x.arc(c, c, 4, 0, Math.PI * 2);
    x.fill();
  });
  const vinylFace = new THREE.MeshStandardMaterial({ map: vinylTex, roughness: 0.42, metalness: 0 });
  const vinylSide = clay('#2B2232', { rough: 0.5 });
  const vinyl = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 40, 1), [vinylSide, vinylFace, vinylFace]);
  const vinylTilt = new THREE.Group();
  vinylTilt.rotation.set(1.3, 0, 0.25);
  vinylTilt.add(vinyl);
  const vinylOrbit = new THREE.Group();
  vinylOrbit.add(vinylTilt);
  group.add(vinylOrbit);

  // ---------- notalar ----------
  const headG = () => {
    const h = new THREE.SphereGeometry(0.062, 10, 7);
    h.scale(1.3, 0.92, 0.6);
    h.rotateZ(0.42);
    return h;
  };
  const eighthParts: THREE.BufferGeometry[] = [];
  {
    eighthParts.push(headG());
    const st = new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6);
    st.translate(0.068, 0.12, 0);
    eighthParts.push(st);
    eighthParts.push(
      tube(
        [
          new THREE.Vector3(0.068, 0.235, 0),
          new THREE.Vector3(0.13, 0.18, 0),
          new THREE.Vector3(0.14, 0.1, 0),
          new THREE.Vector3(0.115, 0.05, 0),
        ],
        0.016,
        12,
        6,
      ),
    );
  }
  const beamParts: THREE.BufferGeometry[] = [];
  {
    const h1 = headG();
    h1.translate(-0.1, 0, 0);
    const h2 = headG();
    h2.translate(0.1, -0.03, 0);
    const s1 = new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6);
    s1.translate(-0.032, 0.125, 0);
    const s2 = new THREE.CylinderGeometry(0.012, 0.012, 0.25, 6);
    s2.translate(0.168, 0.095, 0);
    const bm = rbox(0.23, 0.045, 0.03, 0.012, 2);
    bm.rotateZ(Math.atan2(-0.03, 0.2));
    bm.translate(0.068, 0.235, 0);
    beamParts.push(h1, h2, s1, s2, bm);
  }
  const norm = (list: THREE.BufferGeometry[]) =>
    mergeGeometries(
      list.map((x) => {
        const n = x.index ? x.toNonIndexed() : x;
        for (const k of Object.keys(n.attributes))
          if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
        return n;
      }),
    )!;
  const NN1 = 10;
  const NN2 = 6;
  const mNote = clay(PAL.white, { emissive: 0.18 });
  const notes1 = new THREE.InstancedMesh(norm(eighthParts), mNote, NN1);
  const notes2 = new THREE.InstancedMesh(norm(beamParts), mNote, NN2);
  [notes1, notes2].forEach((n) => {
    n.frustumCulled = false;
    group.add(n);
  });
  const NN = NN1 + NN2;
  type Note = { age: number; life: number; p: THREE.Vector3; v: THREE.Vector3; spin: number; wob: number; s: number };
  const notes: Note[] = [];
  const noteCols = [PAL.coral, PAL.butter, PAL.mint, PAL.sky, PAL.lilac, PAL.pink, PAL.apricot, PAL.leaf].map(
    (c) => new THREE.Color(c),
  );
  for (let i = 0; i < NN; i++) {
    notes.push({ age: 9, life: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0, wob: 0, s: 1 });
    const im = i < NN1 ? notes1 : notes2;
    im.setColorAt(i < NN1 ? i : i - NN1, noteCols[i % noteCols.length]);
  }
  // sıra: tekli ve çiftli notaları karıştır
  const noteOrder: number[] = [];
  for (let i = 0, a = 0, b = 0; i < NN; i++)
    noteOrder.push(i % 3 === 2 && b < NN2 ? NN1 + b++ : a < NN1 ? a++ : NN1 + b++);
  let noteNext = 0;
  const pickW = new THREE.Vector3();
  const spawnNote = (big: boolean) => {
    const n = notes[noteOrder[noteNext]];
    noteNext = (noteNext + 1) % NN;
    n.age = 0;
    n.life = rand(2.2, 3.2);
    n.p.copy(pickW).add(_p.set(rand(-0.3, 0.3), rand(-0.15, 0.3), rand(0, 0.15)));
    const a = rand(0, Math.PI * 2);
    const sp = big ? rand(0.55, 0.85) : rand(0.3, 0.45);
    n.v.set(Math.cos(a) * sp, Math.abs(Math.sin(a)) * sp * 0.8 + 0.15, rand(0.15, 0.4));
    n.spin = rand(-1, 1);
    n.wob = rand(0, 6.28);
    n.s = big ? rand(0.9, 1.25) : rand(0.75, 1.05);
  };
  const camQ = new THREE.Quaternion();
  const grpQ = new THREE.Quaternion();
  const noteQ = new THREE.Quaternion();
  const zAxis = new THREE.Vector3(0, 0, 1);

  // ---------- durum ----------
  const pokeShot = new OneShot(2.7);
  let strumT = -1; // tıngırdatma ilerlemesi 0..1
  let strumDir = 1;
  let strumPow = 0.04;
  let strumDur = 0.32;
  const strumHit = new Uint8Array(NS);
  let nextStrum = 1.2;
  let nextNote = 0.6;
  let ampPump = 0;
  let ampPhase = 0;
  let vinylSpin = 0;
  let vinylBoost = 0;
  let orbitA = 0.6;
  let lightBoost = 0;
  let pokeStrummed = false;
  let pokeBurst = false;
  let lastRingTick = -1;

  const startStrum = (pow: number, dur: number) => {
    strumT = 0;
    strumDir = -strumDir;
    strumPow = pow;
    strumDur = dur;
    strumHit.fill(0);
  };

  return {
    group,
    poke() {
      pokeShot.start();
      pokeStrummed = false;
      pokeBurst = false;
      lastRingTick = -1;
    },
    update(s) {
      const dt = s.dt;
      const t = s.t;
      const h = s.hover;
      const calm = s.reduce ? 0.25 : 1;

      // --- poke hikâyesi: pena geri çekilir → güçlü vuruş → nota patlaması, amfi pompalar ---
      const pp = pokeShot.tick(dt);
      let pokeLift = 0;
      if (pp >= 0) {
        if (pp < 0.12) pokeLift = ease.out(pp / 0.12);
        else if (!pokeStrummed) {
          pokeStrummed = true;
          strumDir = -1; // startStrum çevirir → aşağı vuruş
          startStrum(0.085 * calm, 0.18);
        }
        if (pp > 0.16 && !pokeBurst) {
          pokeBurst = true;
          for (let k = 0; k < 12; k++) spawnNote(true);
          for (let k = 0; k < 6; k++) queuePulse(k * 0.07);
          vinylBoost = 1;
        }
        if (pp > 0.16 && pp < 0.8) {
          ampPump = Math.max(ampPump, 1);
          lightBoost = 1;
          const tick = Math.floor((pp - 0.16) * 2.7 * 3.2);
          if (tick !== lastRingTick) {
            lastRingTick = tick;
            fireRing();
          }
        }
      }
      for (let k = 0; k < pendingPulse.length; k++) {
        if (pendingPulse[k] >= 0) {
          pendingPulse[k] -= dt;
          if (pendingPulse[k] < 0) {
            pendingPulse[k] = -1;
            firePulse(0.75);
          }
        }
      }

      // --- ara sıra kendiliğinden tıngırdatma ---
      nextStrum -= dt * (1 + 1.6 * h);
      if (nextStrum <= 0 && strumT < 0 && !pokeShot.on) {
        startStrum((0.035 + 0.02 * h) * calm, 0.34);
        nextStrum = rand(3.2, 5.2);
      }
      let px = pickRest.x;
      const py = pickRest.y;
      let pz = pickRest.z;
      let prz = -0.5;
      const bob = Math.sin(t * 2.1) * 0.02 * calm;
      if (strumT >= 0) {
        strumT += dt / strumDur;
        const x0 = strumDir > 0 ? -0.2 : 0.2;
        const x1 = -x0;
        if (strumT < 0.25) {
          const w = smooth(0, 0.25, strumT);
          px = THREE.MathUtils.lerp(pickRest.x, x0, w);
          pz = THREE.MathUtils.lerp(pickRest.z, 0.37, w);
        } else if (strumT < 0.75) {
          const w = (strumT - 0.25) / 0.5;
          px = THREE.MathUtils.lerp(x0, x1, ease.inOut(w));
          pz = 0.355;
          prz = -0.5 + strumDir * 0.5 * Math.sin(w * Math.PI);
          for (let i = 0; i < NS; i++) {
            const sx = strX(i, py);
            if (!strumHit[i] && (strumDir > 0 ? px >= sx : px <= sx)) {
              strumHit[i] = 1;
              strAmp[i] = Math.max(strAmp[i], strumPow * (1 - i * 0.06));
              strPhase[i] = t * 3.1 + i;
            }
          }
        } else {
          const w = smooth(0.75, 1, Math.min(1, strumT));
          px = THREE.MathUtils.lerp(x1, pickRest.x, w);
          pz = THREE.MathUtils.lerp(0.355, pickRest.z, w);
        }
        if (strumT >= 0.5 && strumT - dt / strumDur < 0.5) {
          const n = pokeShot.on ? 0 : 2 + Math.round(h);
          for (let q = 0; q < n; q++) spawnNote(false);
          firePulse(0.45);
          ampPump = Math.max(ampPump, 0.45);
          fireRing();
        }
        if (strumT >= 1) strumT = -1;
      }
      pz += pokeLift * 0.12;
      px -= pokeLift * 0.12;
      pick.position.set(px, py + bob, pz);
      pick.rotation.set(-0.35, 0.2, prz - pokeLift * 0.6);
      pick.scale.setScalar(1 + pokeLift * 0.35);
      pick.updateMatrixWorld();
      pick.getWorldPosition(pickW);
      group.worldToLocal(pickW);

      // --- teller ---
      for (let i = 0; i < NS; i++) strAmp[i] *= Math.exp(-dt * 1.7);
      writeStrings(t, h * 0.004 * calm);

      // --- notalar ---
      nextNote -= dt * (1 + 1.5 * h) * calm;
      if (nextNote <= 0) {
        spawnNote(false);
        nextNote = rand(0.9, 1.6);
      }
      group.getWorldQuaternion(grpQ);
      camQ.copy(grpQ).invert().multiply(s.camera.quaternion);
      for (let i = 0; i < NN; i++) {
        const n = notes[i];
        const im = i < NN1 ? notes1 : notes2;
        const id = i < NN1 ? i : i - NN1;
        if (n.age < n.life) {
          n.age += dt;
          const a = n.age;
          n.p.addScaledVector(n.v, dt);
          n.v.multiplyScalar(Math.exp(-dt * 0.6));
          _p.copy(n.p);
          _p.x += Math.sin(a * 2.4 + n.wob) * 0.05;
          _p.y += Math.sin(a * 3.1 + n.wob) * 0.03;
          const r = _p.length();
          if (r > 1.82) _p.multiplyScalar(1.82 / r);
          const sc = n.s * 0.62 * ease.outBack(Math.min(1, a / 0.35)) * smooth(n.life, n.life - 0.5, a);
          noteQ.setFromAxisAngle(zAxis, Math.sin(a * 2.2 + n.wob) * 0.35 + n.spin * a * 0.3);
          _q.copy(camQ).multiply(noteQ);
          _m.compose(_p, _q, _s.setScalar(Math.max(0.0001, sc)));
        } else _m.makeScale(0, 0, 0);
        im.setMatrixAt(id, _m);
      }
      notes1.instanceMatrix.needsUpdate = true;
      notes2.instanceMatrix.needsUpdate = true;

      // --- kablo sinyalleri ---
      for (let i = 0; i < NPULSE; i++) {
        if (pulseU[i] >= 0) {
          pulseU[i] += dt * pulseSpd[i];
          if (pulseU[i] >= 1) {
            pulseU[i] = -1;
            ampPump = Math.max(ampPump, 0.35);
          }
        }
        if (pulseU[i] >= 0) {
          const f = pulseU[i] * CS;
          const fi = Math.floor(f);
          _p.lerpVectors(cableSamples[fi], cableSamples[Math.min(CS, fi + 1)], f - fi);
          const sc = Math.sin(Math.PI * pulseU[i]) * (0.8 + 0.4 * s.night) + 0.2;
          _m.compose(_p, _q.identity(), _s.setScalar(sc));
        } else _m.makeScale(0, 0, 0);
        pulses.setMatrixAt(i, _m);
      }
      pulses.instanceMatrix.needsUpdate = true;

      // --- amfi ---
      ampPump = damp(ampPump, 0, 2.2, dt);
      ampPhase += dt * (9 + 6 * ampPump);
      const pump = ampPump * (0.5 + 0.5 * Math.sin(ampPhase));
      coneG.position.z = 0.1 + pump * 0.035;
      coneG.scale.setScalar(1 + pump * 0.12);
      amp.scale.set(1 + pump * 0.05, 1 - pump * 0.04, 1 + pump * 0.05);
      lightBoost = damp(lightBoost, 0, 2, dt);
      const blink = 0.75 + 0.25 * Math.sin(t * 3.3);
      ampLightMat.color.setRGB(1, 0.42 + 0.3 * lightBoost, 0.48 + 0.2 * lightBoost);
      haloMat.opacity = Math.min(1, (0.25 + 0.45 * s.night + 0.3 * h) * blink + 0.5 * lightBoost);
      halo.scale.setScalar(1 + 0.6 * lightBoost + 0.2 * h);
      for (let i = 0; i < NRING; i++) {
        const rm = ringMeshes[i];
        if (ringAge[i] < 1.2) {
          ringAge[i] += dt;
          const a = Math.min(1, ringAge[i] / 1.2);
          rm.visible = true;
          rm.position.z = 0.12 + a * 0.25;
          rm.scale.setScalar(0.8 + a * 1.6);
          ringMats[i].opacity = (1 - a) * 0.9;
        } else rm.visible = false;
      }

      // --- plak uydu ---
      vinylBoost = damp(vinylBoost, 0, 1.2, dt);
      orbitA += dt * (0.32 + 0.25 * h + 1.6 * vinylBoost) * calm;
      vinylSpin += dt * (2.4 + 2 * h + 10 * vinylBoost) * calm;
      {
        // eğik yörünge: önden gövdenin sol yanından, arkadan sapın arkasından geçer
        // gitarın ekseni boyunca uzanan, ekrana yakın eğik elips: siluetin dışından dolaşır,
        // alt-sağ yarıda gövdenin arkasından geçer
        const a1 = 1.74 * Math.cos(orbitA);
        const a2 = 1.27 * Math.sin(orbitA);
        vinylOrbit.position.set(a1 * 0.296 + a2 * 0.955, a1 * 0.955 - a2 * 0.296, 0.5 * Math.cos(orbitA + 0.8));
      }
      vinyl.rotation.y = -vinylSpin;
      vinylTilt.rotation.z = 0.25 + Math.sin(t * 0.7) * 0.08;

      // --- gezegen salınımı + poke zıplaması ---
      const pj = pp > 0.14 ? ease.outElastic(Math.min(1, (pp - 0.14) / 0.6)) : 1;
      const sq = pp > 0.14 ? (1 - pj) * 0.6 : 0;
      group.position.y = Math.sin(t * 0.9) * 0.04 * calm;
      group.rotation.y = Math.sin(t * 0.35) * 0.14 * calm;
      group.rotation.z = Math.sin(t * 0.6) * 0.03 * calm + sq * 0.12;
      group.scale.set(1 + sq * 0.07, 1 - sq * 0.05, 1 + sq * 0.07);
      strMat.color.setScalar(1 + 0.25 * s.night);
    },
  };
}
