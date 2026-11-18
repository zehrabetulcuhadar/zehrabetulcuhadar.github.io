import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, clay, clayBump, damp, ease, OneShot, PAL, rbox, smooth, tube, type Character } from './kit';

/**
 * Hakkımda: açık bir eskiz defteri, küçük bir dünyanın üstüne kurulmuş.
 * Sayfalardaki karalamalar canlanır (bereli Zero el sallar, evin bacası tüter, yıldızlar parlar),
 * kahve fincanı bir yanardağ gibi tüter, kalemler uydu gibi döner ve biri ara sıra sayfaya çizgi çeker.
 * Dürtünce: sayfalar çevrilir, karalamalar katlanıp yeniden fırlar, yeni bir çizim belirir, kalemler girdap olur.
 */

// ---------- yerel yardımcılar ----------
const _m = new THREE.Matrix4();
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

let vmat: THREE.MeshStandardMaterial | null = null;
/** Köşe renkli kil: birçok renkli statik parçayı tek çizimde birleştirmek için. */
function vclay() {
  if (!vmat)
    vmat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0,
      bumpMap: clayBump(),
      bumpScale: 0.6,
    });
  return vmat;
}

/** Statik parçaları renkleriyle toplayıp tek geometriye birleştirir. */
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
/** Ters kabuk çizgi (mürekkep kontur): köşeleri normal yönünde şişirir. */
function outlineOf(g: THREE.BufferGeometry, t: number) {
  const o = g.clone();
  const p = o.getAttribute('position') as THREE.BufferAttribute;
  const n = o.getAttribute('normal') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  }
  o.deleteAttribute('color');
  return new THREE.Mesh(o, clay(PAL.ink, { side: THREE.BackSide, rough: 1 }));
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
function heartShape(k: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -1 * k);
  s.bezierCurveTo(-0.2 * k, -0.75 * k, -1.05 * k, -0.35 * k, -1.0 * k, 0.25 * k);
  s.bezierCurveTo(-0.95 * k, 0.85 * k, -0.25 * k, 1.0 * k, 0, 0.5 * k);
  s.bezierCurveTo(0.25 * k, 1.0 * k, 0.95 * k, 0.85 * k, 1.0 * k, 0.25 * k);
  s.bezierCurveTo(1.05 * k, -0.35 * k, 0.2 * k, -0.75 * k, 0, -1 * k);
  return s;
}
const ext = (s: THREE.Shape, d: number, b = 0.012) =>
  new THREE.ExtrudeGeometry(s, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: 10,
  }).translate(0, 0, -d / 2);

// ---------- ölçüler ----------
const W = 0.9; // yarım sayfa genişliği
const D = 1.22; // sayfa derinliği (sırt boyunca)
const GAP = 0.05; // spiral için sırttaki boşluk
const PT = 0.12; // sayfa bloğu kalınlığı
const OPEN = 0.1; // V açısı
const INK = '#4a2b45';

function pageTex(side: 'L' | 'R') {
  return canvasTexture(512, 694, (x, w, h) => {
    x.fillStyle = '#FFF9EE';
    x.fillRect(0, 0, w, h);
    // nokta ızgara
    x.fillStyle = 'rgba(124,140,242,0.22)';
    for (let i = 20; i < w; i += 28) for (let j = 20; j < h; j += 28) x.fillRect(i, j, 3, 3);
    // spiral delikleri
    const hx = side === 'L' ? w - 14 : 14;
    x.fillStyle = 'rgba(62,31,56,0.28)';
    for (let k = 0; k < 11; k++) {
      x.beginPath();
      x.arc(hx, 40 + k * ((h - 80) / 10), 6, 0, Math.PI * 2);
      x.fill();
    }
    x.lineCap = 'round';
    x.lineJoin = 'round';
    const scrib = (pts: number[][], col: string, lw: number) => {
      x.strokeStyle = col;
      x.lineWidth = lw;
      x.beginPath();
      pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
      x.stroke();
    };
    const heart = (cx: number, cy: number, k: number, col: string) => {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(cx, cy + k);
      x.bezierCurveTo(cx - k * 1.2, cy, cx - k, cy - k, cx, cy - k * 0.4);
      x.bezierCurveTo(cx + k, cy - k, cx + k * 1.2, cy, cx, cy + k);
      x.fill();
    };
    if (side === 'L') {
      // güneş
      x.fillStyle = '#FFD86B';
      x.beginPath();
      x.arc(70, 70, 34, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = INK;
      x.lineWidth = 4;
      x.stroke();
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        scrib(
          [
            [70 + Math.cos(a) * 44, 70 + Math.sin(a) * 44],
            [70 + Math.cos(a) * 60, 70 + Math.sin(a) * 60],
          ],
          INK,
          4,
        );
      }
      // bulutlar
      const cloud = (cx: number, cy: number) => {
        x.fillStyle = '#fff';
        x.strokeStyle = 'rgba(108,197,238,0.9)';
        x.lineWidth = 4;
        x.beginPath();
        x.arc(cx, cy, 18, Math.PI * 0.6, Math.PI * 1.9);
        x.arc(cx + 26, cy - 8, 22, Math.PI * 1.05, Math.PI * 2.05);
        x.arc(cx + 52, cy + 2, 16, Math.PI * 1.3, Math.PI * 2.5);
        x.closePath();
        x.fill();
        x.stroke();
      };
      cloud(300, 60);
      cloud(170, 150);
      // tepe çimleri
      x.fillStyle = 'rgba(143,214,148,0.55)';
      x.beginPath();
      x.moveTo(0, 560);
      x.quadraticCurveTo(130, 480, 260, 545);
      x.quadraticCurveTo(380, 600, 512, 520);
      x.lineTo(512, 694);
      x.lineTo(0, 694);
      x.fill();
      // evden karaktere kesik yol
      x.setLineDash([10, 12]);
      scrib(
        [
          [150, 300],
          [180, 360],
          [230, 400],
          [300, 420],
        ],
        '#c08a6a',
        5,
      );
      x.setLineDash([]);
      // küçük kalpler, çiçekler
      heart(420, 250, 16, '#F28AC0');
      heart(460, 200, 10, '#F2766B');
      for (const [cx, cy] of [
        [90, 610],
        [200, 640],
        [350, 650],
        [450, 615],
      ]) {
        x.fillStyle = '#F7C548';
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          x.beginPath();
          x.arc(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9, 7, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = '#F2766B';
        x.beginPath();
        x.arc(cx, cy, 6, 0, Math.PI * 2);
        x.fill();
      }
      // yazı
      x.fillStyle = INK;
      x.font = 'italic bold 58px "Comic Sans MS", "Segoe Print", cursive';
      x.textAlign = 'center';
      x.save();
      x.translate(250, 560);
      x.rotate(-0.06);
      x.fillText('Merhaba!', 0, 0);
      x.restore();
    } else {
      // renk paleti lekeleri
      const sw = ['#F2766B', '#F7C548', '#8FD694', '#6CC5EE', '#B79BF5', '#F28AC0'];
      sw.forEach((c, i) => {
        x.fillStyle = c;
        x.beginPath();
        x.ellipse(70 + i * 62, 650, 24, 19, i * 0.5, 0, Math.PI * 2);
        x.fill();
      });
      // yazı
      x.fillStyle = INK;
      x.font = 'italic bold 64px "Comic Sans MS", "Segoe Print", cursive';
      x.textAlign = 'left';
      x.save();
      x.translate(50, 470);
      x.rotate(-0.05);
      x.fillText('Zero', 0, 0);
      x.restore();
      scrib(
        [
          [50, 492],
          [120, 484],
          [200, 488],
          [230, 480],
        ],
        '#F28AC0',
        6,
      );
      // çekirdek eskizleri
      for (const [cx, cy, a] of [
        [440, 520, 0.4],
        [470, 560, -0.6],
      ]) {
        x.save();
        x.translate(cx, cy);
        x.rotate(a);
        x.strokeStyle = '#8A5A44';
        x.lineWidth = 4;
        x.beginPath();
        x.ellipse(0, 0, 16, 11, 0, 0, Math.PI * 2);
        x.stroke();
        x.beginPath();
        x.moveTo(-12, 0);
        x.quadraticCurveTo(0, 5, 12, 0);
        x.stroke();
        x.restore();
      }
      // zikzak ve yıldız karalamaları
      scrib(
        [
          [40, 90],
          [60, 70],
          [80, 90],
          [100, 70],
          [120, 90],
        ],
        '#7C8CF2',
        4,
      );
      x.strokeStyle = '#F7C548';
      x.lineWidth = 4;
      x.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 9 : 22;
        const px = 460 + Math.cos(a) * r;
        const py = 90 + Math.sin(a) * r;
        if (i) x.lineTo(px, py);
        else x.moveTo(px, py);
      }
      x.stroke();
      heart(300, 560, 13, '#F2766B');
    }
  });
}
function edgeTex() {
  return canvasTexture(64, 64, (x, w, h) => {
    x.fillStyle = '#FBF3E3';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(160,130,110,0.35)';
    for (let i = 4; i < h; i += 8) x.fillRect(0, i, w, 2);
  });
}

export default function create(): Character {
  const group = new THREE.Group();
  const root = new THREE.Group(); // sallanma/zıplama için
  group.add(root);

  // ---------- küçük dünya ----------
  const globeC = new THREE.Vector3(0, -0.74, -0.24);
  const GR = 0.8;
  const gb = new Batch();
  gb.add(new THREE.SphereGeometry(GR, 32, 20), PAL.sky, M(globeC.x, globeC.y, globeC.z));
  const patches: [number, number, number, string][] = [
    [0.3, -0.4, 0.9, PAL.leaf],
    [-0.7, -0.2, 0.6, PAL.leaf],
    [0.85, -0.5, -0.1, PAL.butter],
    [-0.4, -0.85, 0.3, PAL.butter],
    [0.1, -0.9, -0.5, PAL.leaf],
    [-0.9, -0.4, -0.3, PAL.mint],
    [0.6, -0.1, 0.75, PAL.mint],
    [-0.2, -0.3, 0.95, PAL.apricot],
    [0.5, -0.3, -0.85, PAL.apricot],
    [-0.5, -0.1, -0.9, PAL.leaf],
    [0.2, 0.2, -1, PAL.mint],
    [0.95, 0.1, -0.4, PAL.leaf],
  ];
  const zA = new THREE.Vector3(0, 0, 1);
  for (const [x, y, z, c] of patches) {
    const d = new THREE.Vector3(x, y, z).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(zA, d);
    const p = globeC.clone().addScaledVector(d, GR - 0.025);
    gb.add(
      new THREE.SphereGeometry(1, 14, 10),
      c,
      new THREE.Matrix4().compose(p, q, new THREE.Vector3(0.3, 0.24, 0.07)),
    );
    const tp = globeC.clone().addScaledVector(d, GR + 0.03);
    gb.add(
      new THREE.SphereGeometry(0.05, 10, 8),
      c === PAL.butter ? PAL.apricot : '#62b06c',
      new THREE.Matrix4().compose(tp, q, new THREE.Vector3(1, 1, 0.9)),
    );
  }
  // yörünge çizgisi (kalemlerin yolu)
  const orbitC = new THREE.Vector3(0, 0.02, 0);
  const orbitR = 1.55;
  const orbitQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3, 0, 0.16));
  gb.add(
    new THREE.TorusGeometry(orbitR, 0.009, 4, 120),
    PAL.periwinkle,
    new THREE.Matrix4().compose(
      orbitC,
      orbitQ.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))),
      new THREE.Vector3(1, 1, 1),
    ),
  );
  root.add(gb.mesh());

  // ---------- defter ----------
  const book = new THREE.Group();
  book.position.set(0, 0.1, 0.06);
  book.rotation.x = 0.46;
  root.add(book);
  const halfL = new THREE.Group();
  const halfR = new THREE.Group();
  halfL.rotation.z = -OPEN;
  halfR.rotation.z = OPEN;
  book.add(halfL, halfR);

  const texL = pageTex('L');
  const texR = pageTex('R');
  const edgeMat = new THREE.MeshStandardMaterial({ map: edgeTex(), roughness: 0.9 });
  const topL = new THREE.MeshStandardMaterial({ map: texL, roughness: 0.9 });
  const topR = new THREE.MeshStandardMaterial({ map: texR, roughness: 0.9 });
  const blockGeo = new THREE.BoxGeometry(W, PT, D);
  const bl = new THREE.Mesh(blockGeo, [edgeMat, edgeMat, topL, edgeMat, edgeMat, edgeMat]);
  bl.position.set(-GAP - W / 2, -PT / 2, 0);
  halfL.add(bl);
  const br = new THREE.Mesh(blockGeo, [edgeMat, edgeMat, topR, edgeMat, edgeMat, edgeMat]);
  br.position.set(GAP + W / 2, -PT / 2, 0);
  halfR.add(br);

  // kapak, spiral, lastik, kurdele (statik, defter uzayında birleştirilir)
  halfL.updateMatrix();
  halfR.updateMatrix();
  const mL = halfL.matrix.clone();
  const mR = halfR.matrix.clone();
  const bb = new Batch();
  const coverG = rbox(W + 0.08, 0.045, D + 0.08, 0.02, 2);
  bb.add(coverG, PAL.coral, mL.clone().multiply(M(-GAP - W / 2, -PT - 0.022, 0)));
  bb.add(coverG, PAL.coral, mR.clone().multiply(M(GAP + W / 2, -PT - 0.022, 0)));
  // kapak köşe süsleri
  for (const sx of [-1, 1]) {
    const mm = sx < 0 ? mL : mR;
    for (const sz of [-1, 1]) {
      bb.add(
        rbox(0.09, 0.05, 0.09, 0.015, 2),
        PAL.butter,
        mm.clone().multiply(M(sx * (GAP + W + 0.0), -PT - 0.022, sz * (D / 2))),
      );
    }
  }
  // arka kapak çıkartmaları (alttan bakınca)
  const yb = -PT - 0.047;
  bb.add(
    ext(starShape(0.12, 0.055), 0.012, 0.006),
    PAL.butter,
    mR.clone().multiply(M(GAP + W * 0.55, yb, -0.15, Math.PI / 2, 0, 0.3)),
  );
  bb.add(
    ext(heartShape(0.09), 0.012, 0.006),
    PAL.pink,
    mL.clone().multiply(M(-GAP - W * 0.45, yb, 0.15, Math.PI / 2, 0, 2.8)),
  );
  bb.add(
    new THREE.CylinderGeometry(0.075, 0.075, 0.012, 20),
    PAL.mint,
    mL.clone().multiply(M(-GAP - W * 0.7, yb, -0.32)),
  );
  bb.add(new THREE.CylinderGeometry(0.05, 0.05, 0.014, 16), PAL.sky, mR.clone().multiply(M(GAP + W * 0.25, yb, 0.3)));
  // sırt kapağı
  bb.add(rbox(GAP * 2 + 0.08, 0.04, D + 0.08, 0.02, 2), '#e0645b', M(0, -PT - 0.06, 0));
  // spiral halkalar
  for (let k = 0; k < 11; k++) {
    const z = -D / 2 + 0.06 + (k * (D - 0.12)) / 10;
    bb.add(new THREE.TorusGeometry(0.07, 0.011, 5, 14), PAL.steel, M(0, -0.045, z));
  }
  // kurdele ayraç (sırttan öne sarkar)
  bb.add(
    tube(
      [
        new THREE.Vector3(0.0, 0.0, D / 2 - 0.12),
        new THREE.Vector3(0.02, 0.0, D / 2 + 0.01),
        new THREE.Vector3(0.05, -0.14, D / 2 + 0.07),
        new THREE.Vector3(0.02, -0.3, D / 2 + 0.06),
      ],
      0.02,
      24,
      6,
    ),
    PAL.pink,
  );
  book.add(bb.mesh());

  // ---------- sayfa karalamaları (pop-up): sol ----------
  const outlineT = 0.011;
  const dL = new THREE.Group();
  halfL.add(dL);
  const lb = new Batch();
  // ev
  const hx = -0.62;
  const hz = -0.28;
  lb.add(rbox(0.24, 0.2, 0.2, 0.03, 2), '#FFE3C8', M(hx, 0.1, hz));
  lb.add(new THREE.ConeGeometry(0.2, 0.16, 4, 1), PAL.coral, M(hx, 0.28, hz, 0, Math.PI / 4, 0));
  lb.add(rbox(0.055, 0.12, 0.055, 0.015, 2), '#d9605a', M(hx + 0.07, 0.31, hz - 0.03));
  lb.add(rbox(0.07, 0.11, 0.02, 0.015, 2), PAL.cocoa, M(hx - 0.04, 0.055, hz + 0.1));
  lb.add(new THREE.SphereGeometry(0.008, 6, 6), PAL.butter, M(hx - 0.02, 0.06, hz + 0.112));
  // ağaçlar
  const trees: [number, number, number][] = [
    [-0.86, -0.45, 1],
    [-0.36, -0.47, 0.8],
    [-0.84, 0.02, 0.9],
  ];
  for (const [x, z, k] of trees) {
    lb.add(new THREE.CylinderGeometry(0.018 * k, 0.026 * k, 0.16 * k, 8), PAL.cocoa, M(x, 0.08 * k, z));
    lb.add(new THREE.SphereGeometry(0.075 * k, 12, 8), PAL.leaf, M(x, 0.2 * k, z));
    lb.add(new THREE.SphereGeometry(0.055 * k, 10, 7), PAL.leaf, M(x - 0.05 * k, 0.16 * k, z + 0.02));
    lb.add(new THREE.SphereGeometry(0.055 * k, 10, 7), PAL.leaf, M(x + 0.05 * k, 0.17 * k, z - 0.01));
    lb.add(new THREE.SphereGeometry(0.014, 6, 6), PAL.coral, M(x + 0.03 * k, 0.24 * k, z + 0.06 * k));
    lb.add(new THREE.SphereGeometry(0.014, 6, 6), PAL.coral, M(x - 0.05 * k, 0.19 * k, z + 0.06 * k));
  }
  const leftStatic = new THREE.Mesh(lb.geometry(), vclay());
  dL.add(leftStatic, outlineOf(leftStatic.geometry, outlineT));

  // Zero karakteri (bereli küçük ressam)
  const zero = new THREE.Group();
  zero.position.set(-0.36, 0, 0.1);
  dL.add(zero);
  const SKIN = '#FFD9BE';
  const zb = new Batch();
  zb.add(new THREE.SphereGeometry(0.12, 22, 14), SKIN, M(0, 0.15, 0, 0, 0, 0, 1, 1.12, 0.95));
  zb.add(new THREE.SphereGeometry(0.035, 10, 8), SKIN, M(-0.05, 0.025, 0.01, 0, 0, 0, 1, 0.7, 1.3));
  zb.add(new THREE.SphereGeometry(0.035, 10, 8), SKIN, M(0.05, 0.025, 0.01, 0, 0, 0, 1, 0.7, 1.3));
  // bere
  zb.add(new THREE.SphereGeometry(0.1, 20, 12), PAL.lilac, M(0.015, 0.275, -0.005, 0, 0, -0.25, 1, 0.35, 1));
  zb.add(new THREE.CylinderGeometry(0.006, 0.01, 0.035, 6), PAL.lilac, M(0.03, 0.31, 0, 0, 0, -0.3));
  // yüz
  zb.add(new THREE.SphereGeometry(0.016, 10, 8), PAL.ink, M(-0.042, 0.17, 0.105, 0, 0, 0, 1, 1.3, 0.6));
  zb.add(new THREE.SphereGeometry(0.016, 10, 8), PAL.ink, M(0.042, 0.17, 0.105, 0, 0, 0, 1, 1.3, 0.6));
  zb.add(new THREE.SphereGeometry(0.005, 6, 6), PAL.white, M(-0.037, 0.178, 0.114));
  zb.add(new THREE.SphereGeometry(0.005, 6, 6), PAL.white, M(0.047, 0.178, 0.114));
  zb.add(new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), PAL.ink, M(0, 0.135, 0.11, 0, 0, Math.PI));
  zb.add(new THREE.SphereGeometry(0.018, 8, 6), PAL.pink, M(-0.075, 0.135, 0.085, 0, 0, 0, 1, 0.6, 0.4));
  zb.add(new THREE.SphereGeometry(0.018, 8, 6), PAL.pink, M(0.075, 0.135, 0.085, 0, 0, 0, 1, 0.6, 0.4));
  // sol el + minik kalem
  zb.add(new THREE.SphereGeometry(0.028, 10, 8), SKIN, M(-0.125, 0.11, 0.03));
  zb.add(new THREE.CylinderGeometry(0.008, 0.008, 0.11, 6), PAL.mint, M(-0.135, 0.13, 0.04, 0.3, 0, 0.35));
  zb.add(new THREE.ConeGeometry(0.008, 0.02, 6), PAL.cream, M(-0.155, 0.08, 0.025, 0.3 + Math.PI, 0, 0.35));
  const zeroBody = new THREE.Mesh(zb.geometry(), vclay());
  zero.add(zeroBody, outlineOf(zeroBody.geometry, outlineT * 0.8));
  // sallanan kol
  const armPivot = new THREE.Group();
  armPivot.position.set(0.1, 0.17, 0);
  zero.add(armPivot);
  const ab = new Batch();
  ab.add(new THREE.CapsuleGeometry(0.022, 0.07, 4, 8), SKIN, M(0, 0.05, 0));
  ab.add(new THREE.SphereGeometry(0.03, 10, 8), SKIN, M(0, 0.1, 0));
  const arm = new THREE.Mesh(ab.geometry(), vclay());
  armPivot.add(arm, outlineOf(arm.geometry, outlineT * 0.8));

  // pencere ışığı (gece parlar)
  const winMat = new THREE.MeshStandardMaterial({
    color: PAL.butter,
    emissive: PAL.butter,
    emissiveIntensity: 0.4,
    roughness: 0.6,
  });
  const win = new THREE.Mesh(rbox(0.06, 0.06, 0.02, 0.012, 2), winMat);
  win.position.set(hx + 0.05, 0.12, hz + 0.1);
  dL.add(win);

  // ---------- sağ sayfa ----------
  const dR = new THREE.Group();
  halfR.add(dR);
  const rb = new Batch();
  // kahve yanardağı: yeşil tepe + fincan
  const vx = 0.6;
  const vz = -0.14;
  const V2 = (a: number, b: number) => new THREE.Vector2(a, b);
  rb.add(
    new THREE.LatheGeometry(
      [V2(0, 0), V2(0.33, 0), V2(0.3, 0.04), V2(0.22, 0.1), V2(0.16, 0.145), V2(0.13, 0.155), V2(0, 0.155)],
      28,
    ),
    PAL.leaf,
    M(vx, 0, vz),
  );
  rb.add(
    new THREE.LatheGeometry(
      [
        V2(0, 0.15),
        V2(0.1, 0.15),
        V2(0.12, 0.165),
        V2(0.145, 0.33),
        V2(0.155, 0.36),
        V2(0.14, 0.365),
        V2(0.13, 0.335),
        V2(0.0, 0.335),
      ],
      32,
    ),
    '#FFF6EA',
    M(vx, 0, vz),
  );
  rb.add(
    new THREE.TorusGeometry(0.065, 0.02, 8, 18, Math.PI * 1.25),
    '#FFF6EA',
    M(vx + 0.15, 0.26, vz, 0, 0, -Math.PI * 0.62),
  );
  rb.add(new THREE.TorusGeometry(0.137, 0.012, 6, 32), PAL.pink, M(vx, 0.25, vz, Math.PI / 2, 0, 0));
  rb.add(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 32), PAL.cocoa, M(vx, 0.345, vz));
  // taşan kahve damlaları
  for (const [a, len] of [
    [0.6, 0.21],
    [1.5, 0.15],
    [2.4, 0.24],
    [-1.1, 0.19],
  ]) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const P = (r: number, y: number) => new THREE.Vector3(vx + ca * r, y, vz + sa * r);
    rb.add(tube([P(0.13, 0.355), P(0.155, 0.345), P(0.15, 0.3), P(0.145, 0.355 - len)], 0.017, 16, 6), PAL.cocoa);
    rb.add(new THREE.SphereGeometry(0.022, 8, 6), PAL.cocoa, M(vx + ca * 0.145, 0.355 - len, vz + sa * 0.145));
  }
  // tepedeki renkli şekerler (lav)
  const spr = [PAL.coral, PAL.butter, PAL.sky, PAL.pink, PAL.lilac, PAL.white];
  for (let i = 0; i < 18; i++) {
    const a = i * 2.4;
    const r = 0.18 + (i % 3) * 0.045;
    const y = 0.155 * (1 - (r - 0.13) / 0.2) + 0.008;
    rb.add(
      new THREE.CapsuleGeometry(0.009, 0.025, 1, 5),
      spr[i % spr.length],
      M(vx + Math.cos(a) * r, Math.max(0.012, y), vz + Math.sin(a) * r, Math.PI / 2, 0, a),
    );
  }
  // kahve çekirdekleri
  for (const [x, z, a] of [
    [0.84, 0.2, 0.5],
    [0.88, 0.08, -0.4],
    [0.12, -0.55, 1.1],
  ]) {
    rb.add(new THREE.SphereGeometry(0.035, 10, 6), PAL.cocoa, M(x, 0.018, z, 0, a, 0, 1, 0.55, 0.7));
  }
  // gökkuşağı (bulutlu)
  const rx0 = 0.28;
  const rz0 = -0.42;
  [PAL.coral, PAL.butter, PAL.mint, PAL.periwinkle].forEach((c, i) =>
    rb.add(new THREE.TorusGeometry(0.17 - i * 0.032, 0.017, 8, 24, Math.PI), c, M(rx0, 0.0, rz0, 0, 0.15, 0)),
  );
  for (const sd of [-1, 1]) {
    const cxr = rx0 + sd * 0.135;
    rb.add(new THREE.SphereGeometry(0.05, 12, 8), PAL.white, M(cxr, 0.03, rz0 - sd * 0.02));
    rb.add(new THREE.SphereGeometry(0.035, 10, 8), PAL.white, M(cxr + 0.045, 0.02, rz0 - sd * 0.02 + 0.01));
    rb.add(new THREE.SphereGeometry(0.035, 10, 8), PAL.white, M(cxr - 0.045, 0.02, rz0 - sd * 0.02 + 0.01));
  }
  const rightStatic = new THREE.Mesh(rb.geometry(), vclay());
  dR.add(rightStatic, outlineOf(rightStatic.geometry, outlineT));
  // kahve kabarcığı
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), clay('#c79a7e'));
  dR.add(bubble);

  // ---------- duman / buhar ----------
  const NPUFF = 9;
  const puffGeo = new THREE.SphereGeometry(1, 9, 6);
  const smokeL = new THREE.InstancedMesh(puffGeo, clay('#F4F1FA'), 6);
  const steamR = new THREE.InstancedMesh(puffGeo, clay('#FFFFFF'), NPUFF);
  smokeL.frustumCulled = steamR.frustumCulled = false;
  dL.add(smokeL);
  dR.add(steamR);

  // ---------- yıldızlar (sayfaların üstünde süzülür) ----------
  const starMat = new THREE.MeshStandardMaterial({
    color: PAL.butter,
    emissive: PAL.butter,
    emissiveIntensity: 0.4,
    roughness: 0.7,
  });
  const starPos: [number, number, number][] = [
    [-0.75, 0.48, -0.1],
    [-0.15, 0.55, -0.35],
    [-0.5, 0.62, 0.3],
    [0.12, 0.45, 0.3],
    [0.85, 0.62, -0.42],
    [0.4, 0.78, -0.05],
    [-0.95, 0.3, 0.5],
  ];
  const stars = new THREE.InstancedMesh(ext(starShape(0.05, 0.024), 0.03, 0.012), starMat, starPos.length);
  stars.frustumCulled = false;
  book.add(stars);
  const starBase = starPos.map(([x, y, z]) => new THREE.Vector3(x, y, z));

  // ---------- çizilen çizgi (kalem sayfaya yazar) ----------
  const linePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    const a = u * Math.PI * 2 * 3.5;
    linePts.push(
      new THREE.Vector3(0.36 + u * 0.48 - Math.sin(a) * 0.035, 0.006, 0.47 - u * 0.06 - Math.cos(a) * 0.045),
    );
  }
  const lineCurve = new THREE.CatmullRomCurve3(linePts);
  const LSEG = 140;
  const LRAD = 5;
  const lineMat = new THREE.MeshStandardMaterial({
    color: PAL.periwinkle,
    emissive: PAL.periwinkle,
    emissiveIntensity: 0.15,
    roughness: 0.8,
  });
  const lineMesh = new THREE.Mesh(new THREE.TubeGeometry(lineCurve, LSEG, 0.009, LRAD, false), lineMat);
  lineMesh.geometry.setDrawRange(0, 0);
  lineMesh.frustumCulled = false;
  halfR.add(lineMesh);

  // ---------- kalemler (uydular) ----------
  const NP = 4;
  const pencilCols = [PAL.butter, PAL.sky, PAL.coral, PAL.mint];
  const TIP = 0.255; // merkezden uca
  const mkI = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const im = new THREE.InstancedMesh(g, m, NP);
    im.frustumCulled = false;
    root.add(im);
    return im;
  };
  const pBody = mkI(new THREE.CylinderGeometry(0.042, 0.042, 0.3, 6), clay(PAL.white));
  const pWood = mkI(new THREE.CylinderGeometry(0.012, 0.042, 0.08, 6).translate(0, 0.19, 0), clay('#F6D9B0'));
  const pLead = mkI(new THREE.ConeGeometry(0.012, 0.025, 6).translate(0, 0.2425, 0), clay(PAL.white));
  const pFer = mkI(
    new THREE.CylinderGeometry(0.045, 0.045, 0.045, 12).translate(0, -0.1725, 0),
    clay(PAL.steel, { rough: 0.5 }),
  );
  const pEra = mkI(
    mergeGeometries([
      new THREE.CylinderGeometry(0.042, 0.042, 0.05, 12).translate(0, -0.22, 0).toNonIndexed(),
      new THREE.SphereGeometry(0.042, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
        .translate(0, -0.245, 0)
        .toNonIndexed(),
    ])!,
    clay(PAL.pink),
  );
  const _c = new THREE.Color();
  for (let i = 0; i < NP; i++) {
    _c.set(pencilCols[i]);
    pBody.setColorAt(i, _c);
    pLead.setColorAt(i, _c.multiplyScalar(0.8));
  }
  const pAng = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  const pencilParts = [pBody, pWood, pLead, pFer, pEra];

  // ---------- çevrilen sayfalar ----------
  const SEG = 20;
  const texLb = texL.clone();
  texLb.wrapS = THREE.RepeatWrapping;
  texLb.repeat.x = -1;
  texLb.offset.x = 1;
  texLb.needsUpdate = true;
  const flipFront = new THREE.MeshStandardMaterial({ map: texR, roughness: 0.9, side: THREE.FrontSide });
  const flipBack = new THREE.MeshStandardMaterial({ map: texLb, roughness: 0.9, side: THREE.BackSide });
  const flips: { geo: THREE.PlaneGeometry; meshes: THREE.Mesh[] }[] = [];
  for (let k = 0; k < 2; k++) {
    const geo = new THREE.PlaneGeometry(W, D, SEG, 1);
    const a = new THREE.Mesh(geo, flipFront);
    const b = new THREE.Mesh(geo, flipBack);
    a.visible = b.visible = false;
    a.frustumCulled = b.frustumCulled = false;
    book.add(a, b);
    flips.push({ geo, meshes: [a, b] });
  }
  const segX = new Float32Array(SEG + 1);
  const segY = new Float32Array(SEG + 1);
  function bendPage(geo: THREE.PlaneGeometry, f: number, lift: number) {
    // f: 0 sağda yatık, 1 solda yatık
    const th = OPEN + f * (Math.PI - 2 * OPEN);
    const curl = Math.sin(f * Math.PI) * 1.1;
    const ds = W / SEG;
    let x = GAP * (1 - 2 * f);
    let y = 0.004 + lift;
    segX[0] = x;
    segY[0] = y;
    for (let i = 1; i <= SEG; i++) {
      const ph = th - curl * ((i - 0.5) / SEG);
      x += Math.cos(ph) * ds;
      y += Math.sin(ph) * ds;
      segX[i] = x;
      segY[i] = y;
    }
    const p = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let j = 0; j < 2; j++) {
      for (let i = 0; i <= SEG; i++) p.setXYZ(j * (SEG + 1) + i, segX[i], segY[i], j === 0 ? -D / 2 : D / 2);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // ---------- yeni çizimler (dürtünce belirir) ----------
  const pops: THREE.Group[] = [];
  {
    const g1 = new Batch(); // kalp
    g1.add(ext(heartShape(0.11), 0.05, 0.015), PAL.coral, M(0, 0.13, 0));
    g1.add(new THREE.SphereGeometry(0.018, 8, 6), PAL.white, M(-0.05, 0.17, 0.04));
    const g2 = new Batch(); // çiçek
    g2.add(new THREE.CylinderGeometry(0.012, 0.014, 0.18, 6), '#62b06c', M(0, 0.09, 0));
    g2.add(new THREE.SphereGeometry(0.04, 10, 8), '#62b06c', M(0.04, 0.07, 0, 0, 0, -0.7, 1, 0.35, 0.6));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g2.add(
        new THREE.SphereGeometry(0.045, 8, 6),
        PAL.pink,
        M(Math.cos(a) * 0.055, 0.21 + Math.sin(a) * 0.055, 0, 0, 0, 0, 1, 1, 0.5),
      );
    }
    g2.add(new THREE.SphereGeometry(0.04, 12, 8), PAL.butter, M(0, 0.21, 0.015, 0, 0, 0, 1, 1, 0.7));
    const g3 = new Batch(); // ampul (fikir!)
    g3.add(new THREE.SphereGeometry(0.085, 18, 12), '#FFF1B0', M(0, 0.18, 0));
    g3.add(new THREE.CylinderGeometry(0.04, 0.045, 0.07, 12), PAL.steel, M(0, 0.08, 0));
    for (let i = 0; i < 3; i++)
      g3.add(new THREE.TorusGeometry(0.043, 0.006, 4, 14), PAL.steel, M(0, 0.06 + i * 0.02, 0, Math.PI / 2, 0, 0));
    g3.add(new THREE.SphereGeometry(0.03, 8, 6), PAL.ink, M(0, 0.035, 0, 0, 0, 0, 1, 0.6, 1));
    for (const g of [g1, g2, g3]) {
      const grp = new THREE.Group();
      const m = new THREE.Mesh(g.geometry(), vclay());
      grp.add(m, outlineOf(m.geometry, outlineT));
      grp.position.set(0.17, 0, 0.04);
      grp.scale.setScalar(0.001);
      grp.visible = false;
      dR.add(grp);
      pops.push(grp);
    }
  }
  const NSP = 10;
  const sparks = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({
      color: PAL.butter,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    NSP,
  );
  sparks.frustumCulled = false;
  dR.add(sparks);

  // ---------- durum ----------
  const shot = new OneShot(2.8);
  let popIdx = -1;
  let popAge = 99;
  let swirl = 0;
  let orbitA = 0;
  const pageToRoot = new THREE.Matrix4();
  const rootInv = new THREE.Matrix4();
  const tipP = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const tanV = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  const qa = new THREE.Quaternion();
  const qb = new THREE.Quaternion();
  const Y = new THREE.Vector3(0, 1, 0);
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  const tmpM = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);

  function puff(im: THREE.InstancedMesh, i: number, x: number, y: number, z: number, sc: number) {
    _m.compose(_v.set(x, y, z), _q.identity(), _s.set(sc, sc, sc));
    im.setMatrixAt(i, _m);
  }

  function update(s: Parameters<Character['update']>[0]) {
    const dt = s.dt;
    const t = s.t;
    const hov = s.hover;
    const red = s.reduce ? 0.25 : 1;
    const live = 1 + hov * 1.2;
    const p = shot.tick(dt);
    const on = p >= 0;
    popAge += dt;

    // tüm gezegen: hafif salınım
    root.position.y = 0.2 + Math.sin(t * 0.9) * 0.035 * red;
    root.rotation.y = Math.sin(t * 0.25) * 0.12 * red;
    root.rotation.z = Math.sin(t * 0.6 + 1) * 0.02 * red;
    const hop = on ? Math.sin(Math.min(1, p / 0.22) * Math.PI) * 0.08 : 0;
    book.position.y = 0.1 + hop + Math.sin(t * 1.3) * 0.01 * red;

    // sayfa çevirme
    for (let k = 0; k < 2; k++) {
      const f = on ? smooth(0.06 + k * 0.12, 0.4 + k * 0.12, p) : 0;
      const vis = on && f > 0.001 && f < 0.999;
      flips[k].meshes[0].visible = flips[k].meshes[1].visible = vis;
      if (vis) bendPage(flips[k].geo, ease.inOut(f), k * 0.003);
    }
    // pop-up karalamalar katlanıp yeniden açılır
    let fold = 1;
    if (on) {
      const down = smooth(0.0, 0.07, p);
      const up = p < 0.55 ? 0 : ease.outElastic(Math.min(1, (p - 0.55) / 0.35));
      fold = Math.max(0.03, 1 - down + down * up);
    }
    dL.scale.y = fold;
    dR.scale.y = fold;

    // yeni çizim
    if (on && p > 0.55 && popAge > 50) popAge = 0;
    for (let i = 0; i < pops.length; i++) {
      const g = pops[i];
      if (i !== popIdx || popAge > 50) {
        g.visible = false;
        continue;
      }
      const sc = Math.max(0.001, ease.outBack(Math.min(1, popAge / 0.6)) * (1 - smooth(6, 6.8, popAge)));
      g.visible = sc > 0.002;
      g.scale.setScalar(sc);
      g.rotation.y = Math.sin(t * 1.5) * 0.35 * red;
      g.position.y = Math.sin(t * 2.2) * 0.012 * red;
    }
    for (let i = 0; i < NSP; i++) {
      const k = popAge / 1.1;
      if (k > 1) {
        sparks.setMatrixAt(i, hide);
        continue;
      }
      const a = (i / NSP) * Math.PI * 2;
      const r = 0.06 + ease.out(k) * 0.3;
      const sc = 0.024 * Math.sin(k * Math.PI);
      _m.compose(
        _v.set(0.17 + Math.cos(a) * r, 0.18 + Math.sin(a) * r * 0.8 + k * 0.08, 0.04 + Math.sin(a * 3) * 0.05),
        _q.setFromEuler(_e.set(t * 3, a, 0)),
        _s.set(sc, sc * 1.7, sc),
      );
      sparks.setMatrixAt(i, _m);
    }
    sparks.instanceMatrix.needsUpdate = true;

    // Zero el sallar; dürtünce sevinçle zıplar
    const wave = Math.sin(t * (5 + hov * 4));
    armPivot.rotation.z = -0.95 + wave * (0.35 + 0.2 * hov) * red - (on ? 0.5 * Math.sin(Math.PI * p) : 0);
    const jump = on && p > 0.6 ? Math.abs(Math.sin(((p - 0.6) / 0.4) * Math.PI * 2)) * 0.09 : 0;
    zero.position.y = jump + Math.abs(Math.sin(t * 2.2)) * 0.012 * red;
    zero.rotation.z = Math.sin(t * 2.2) * 0.06 * red;
    zero.rotation.y = 0.3 + Math.sin(t * 0.7) * 0.25 * red;

    // baca dumanı
    for (let i = 0; i < 6; i++) {
      const u = (t * 0.32 * live * red + i / 6) % 1;
      const fade = Math.max(0, Math.sin(Math.min(1, u * 1.15) * Math.PI));
      puff(
        smokeL,
        i,
        hx + 0.07 + Math.sin(u * 6 + i) * 0.03 + u * 0.06,
        0.38 + u * 0.36,
        hz - 0.03 - u * 0.05,
        (0.022 + u * 0.05) * fade,
      );
    }
    smokeL.instanceMatrix.needsUpdate = true;
    // fincan buharı
    const boost = 1 + (on ? Math.sin(Math.PI * p) * 1.5 : 0);
    for (let i = 0; i < NPUFF; i++) {
      const u = (t * 0.28 * live * red + i / NPUFF) % 1;
      const fade = Math.max(0, Math.sin(Math.min(1, u * 1.1) * Math.PI));
      const sw = Math.sin(u * 7 + i * 1.7) * 0.05 * (0.4 + u);
      puff(
        steamR,
        i,
        vx + sw + ((i % 3) - 1) * 0.03,
        0.4 + u * 0.55 * boost,
        vz + Math.cos(u * 5 + i) * 0.03,
        (0.03 + u * 0.065) * (0.8 + 0.25 * boost) * fade,
      );
    }
    steamR.instanceMatrix.needsUpdate = true;
    const bu = (t * 0.6) % 1;
    const bs = bu < 0.7 ? (bu / 0.7) * 0.035 : 0.0001;
    bubble.scale.set(bs, bs * 0.8, bs);
    bubble.position.set(vx - 0.04, 0.35, vz + 0.03);

    // yıldızlar parıldar
    const burst = on ? Math.sin(Math.min(1, p / 0.6) * Math.PI) : 0;
    for (let i = 0; i < starBase.length; i++) {
      const tw = 0.75 + 0.35 * Math.sin(t * (2.1 + i * 0.37) + i * 1.9);
      _v.copy(starBase[i]);
      _v.x *= 1 + burst * 0.3;
      _v.y += Math.sin(t * 1.1 + i) * 0.03 * red + burst * 0.25;
      const sc = tw * (1 + hov * 0.25) * (1 + burst * 0.4);
      _q.setFromEuler(_e.set(-0.46, Math.sin(t * 0.8 + i) * 0.35, Math.sin(t + i) * 0.2 + burst * 6.28));
      _m.compose(_v, _q, _s.set(sc, sc, sc));
      stars.setMatrixAt(i, _m);
    }
    stars.instanceMatrix.needsUpdate = true;
    starMat.emissiveIntensity = 0.35 + 0.5 * s.night + 0.25 * hov + 0.15 * Math.sin(t * 3);
    winMat.emissiveIntensity = 0.3 + 1.4 * s.night;
    lineMat.emissiveIntensity = 0.15 + 0.6 * s.night;

    // ---------- kalemler ----------
    swirl = damp(swirl, on ? Math.sin(Math.PI * p) : 0, 8, dt);
    orbitA += dt * (0.35 * live + swirl * 5) * red;
    // çizim döngüsü (kalem 0): uç, yaz, dön; çizgi bir süre kalır, sonra silinir
    const cyc = (t + 4) % 11;
    let w = 0;
    let prog = 1;
    let erase = 0;
    if (cyc < 1.2) {
      w = ease.inOut(cyc / 1.2);
      prog = 0;
    } else if (cyc < 3.6) {
      w = 1;
      prog = (cyc - 1.2) / 2.4;
    } else if (cyc < 4.8) {
      w = 1 - ease.inOut((cyc - 3.6) / 1.2);
    } else erase = smooth(8.6, 10.2, cyc);
    if (s.reduce) w = 0;
    w *= 1 - swirl;
    const segs = Math.floor(prog * LSEG);
    const startSeg = Math.floor(erase * LSEG);
    lineMesh.geometry.setDrawRange(startSeg * LRAD * 6, Math.max(0, segs - startSeg) * LRAD * 6);

    halfR.updateWorldMatrix(true, false);
    rootInv.copy(root.matrixWorld).invert();
    pageToRoot.multiplyMatrices(rootInv, halfR.matrixWorld);

    for (let i = 0; i < NP; i++) {
      const a = orbitA + pAng[i];
      const rr = orbitR * (1 - swirl * 0.15 * (1 + Math.sin(a * 2 + t * 3))) + Math.sin(t * 1.3 + i) * 0.03;
      pos
        .set(Math.cos(a) * rr, Math.sin(t * 1.7 + i * 2) * 0.05 + swirl * 0.2 * Math.sin(a * 3), Math.sin(a) * rr)
        .applyQuaternion(orbitQ)
        .add(orbitC);
      tanV
        .set(-Math.sin(a), 0.15 * Math.cos(t + i), Math.cos(a))
        .applyQuaternion(orbitQ)
        .normalize();
      qa.setFromUnitVectors(Y, tanV);
      qa.multiply(_q.setFromAxisAngle(Y, t * (1 + swirl * 8) + i));
      if (i === 0 && w > 0.001) {
        lineCurve.getPointAt(Math.min(1, prog), tipP);
        const scribble = w > 0.99 && cyc > 1.2 && cyc < 3.6 ? 1 : 0;
        tipP.y += 0.004;
        tipP.applyMatrix4(pageToRoot);
        upV.set(0.3, 1, 0.5).transformDirection(pageToRoot);
        qb.setFromUnitVectors(Y, _s.copy(upV).negate());
        qb.multiply(_q.setFromAxisAngle(Y, Math.sin(t * 9) * 0.3 * scribble));
        const lift = (1 - smooth(0.6, 1, w)) * 0.3 + Math.abs(Math.sin(t * 14)) * 0.006 * scribble;
        tgt.copy(tipP).addScaledVector(upV, TIP + lift);
        pos.lerp(tgt, w);
        qa.slerp(qb, w);
      }
      tmpM.compose(pos, qa, one);
      for (const im of pencilParts) im.setMatrixAt(i, tmpM);
    }
    for (const im of pencilParts) im.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    update,
    poke() {
      shot.start();
      popIdx = (popIdx + 1) % pops.length;
      popAge = 99;
    },
  };
}
