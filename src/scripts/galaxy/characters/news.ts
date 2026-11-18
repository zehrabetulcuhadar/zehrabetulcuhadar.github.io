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
  tube,
  type Character,
  type CharacterState,
} from './kit';

/**
 * "News": gazete sayfalarıyla hediye paketi gibi sarılmış, kurdeleli bir gezegen.
 * Tepesinde gökyüzünü tarayan, nabız halkaları yayan bir uydu çanağı var.
 * Yüzeydeki manşet kupürleri kalkıp origami turnaya katlanır, kanat çırpıp bir tur atar,
 * sonra başka bir yere konup yeniden düz bir kupüre açılır.
 * Dürtünce fiyonk çözülüp zıplar, turnalar topluca havalanır, çanak fırıl fırıl döner.
 */

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const TINTS = ['#FBF6EC', '#FBE5E2', '#E2F4EE', '#FCF0CF', '#E2EEFA', '#EEE6FA'];
const ACCENTS = [PAL.coral, PAL.mint, PAL.periwinkle, PAL.butter, PAL.pink, PAL.sky, PAL.lilac, PAL.apricot];
const MASTHEADS = [
  'THE ZERO TIMES',
  'TECH DAILY',
  'AI WEEKLY',
  'BYTE POST',
  'DEV GAZETTE',
  'WEB NEWS',
  'CODE HERALD',
  'GALAXY WIRE',
];
const HEADS = [
  'NEW CHIP BREAKS RECORD',
  'ROBOTS LEARN TO DANCE',
  'OPEN SOURCE WINS',
  'QUANTUM LEAP!',
  'LAUNCH DAY',
  'BUG FIXED AT LAST',
  'APP OF THE YEAR',
  'AI WRITES POEMS',
  'WEB 4.0 IS HERE',
  'CLOUD GETS FLUFFY',
];

/** Gazete sayfası: başlık, manşet, sütunlar, pastel görsel kutuları. */
function drawPage(x: CanvasRenderingContext2D, w: number, h: number, seed: number, big: boolean) {
  const rnd = (k: number) => {
    const v = Math.sin(seed * 91.7 + k * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  x.fillStyle = TINTS[seed % TINTS.length];
  x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(62,31,56,0.18)';
  x.lineWidth = Math.max(2, w * 0.008);
  x.strokeRect(1, 1, w - 2, h - 2);
  const pad = w * 0.06;
  const acc = ACCENTS[seed % ACCENTS.length];
  // başlık
  x.fillStyle = PAL.ink;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  let fs = h * (big ? 0.1 : 0.11);
  x.font = `900 ${fs}px ${SERIF}`;
  const mast = MASTHEADS[seed % MASTHEADS.length];
  while (x.measureText(mast).width > w - pad * 2 && fs > 6) {
    fs *= 0.92;
    x.font = `900 ${fs}px ${SERIF}`;
  }
  x.fillText(mast, w / 2, pad + fs * 0.55);
  let y = pad + fs * 1.2;
  x.fillStyle = 'rgba(62,31,56,0.55)';
  x.fillRect(pad, y, w - pad * 2, Math.max(2, h * 0.008));
  y += h * 0.02;
  x.fillRect(pad, y, w - pad * 2, Math.max(1, h * 0.003));
  y += h * 0.035;
  // manşet şeridi
  const head = HEADS[(seed * 3 + 1) % HEADS.length];
  let hs = h * 0.075;
  x.font = `900 ${hs}px ${SANS}`;
  while (x.measureText(head).width > w - pad * 2 && hs > 6) {
    hs *= 0.92;
    x.font = `900 ${hs}px ${SANS}`;
  }
  x.fillStyle = acc;
  x.fillText(head, w / 2, y + hs * 0.6);
  y += hs * 1.35;
  // sütunlar
  const cols = big ? 3 : 2 + (seed % 2);
  const gap = w * 0.04;
  const cw = (w - pad * 2 - gap * (cols - 1)) / cols;
  const lh = Math.max(3, h * 0.022);
  for (let c = 0; c < cols; c++) {
    const cx = pad + c * (cw + gap);
    let cy = y;
    const imgAt = Math.floor(rnd(c) * 3);
    let k = 0;
    while (cy < h - pad - lh) {
      if (k === imgAt && cy + cw * 0.7 < h - pad) {
        const ih = cw * 0.7;
        x.fillStyle = ACCENTS[(seed + c * 3) % ACCENTS.length];
        x.globalAlpha = 0.75;
        x.fillRect(cx, cy, cw, ih);
        x.globalAlpha = 1;
        drawIcon(x, cx + cw / 2, cy + ih / 2, ih * 0.32, (seed + c) % 5);
        cy += ih + lh;
      } else {
        x.fillStyle = 'rgba(62,31,56,0.32)';
        const lw = cw * (rnd(k * 7 + c) > 0.85 ? 0.6 : 1);
        x.fillRect(cx, cy, lw, lh * 0.55);
        cy += lh;
      }
      k++;
    }
  }
}

function drawIcon(x: CanvasRenderingContext2D, cx: number, cy: number, s: number, kind: number) {
  x.save();
  x.fillStyle = 'rgba(255,255,255,0.9)';
  x.strokeStyle = 'rgba(255,255,255,0.95)';
  x.lineWidth = s * 0.18;
  x.lineCap = 'round';
  if (kind === 0) {
    // çubuk grafik
    for (let i = 0; i < 4; i++)
      x.fillRect(cx - s + i * s * 0.55, cy + s * 0.7 - s * (0.5 + i * 0.35), s * 0.36, s * (0.5 + i * 0.35));
  } else if (kind === 1) {
    // çip
    x.fillRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2);
    for (let i = -1; i <= 1; i++) {
      x.fillRect(cx + i * s * 0.4 - s * 0.08, cy - s, s * 0.16, s * 2);
      x.fillRect(cx - s, cy + i * s * 0.4 - s * 0.08, s * 2, s * 0.16);
    }
  } else if (kind === 2) {
    // robot yüzü
    x.fillRect(cx - s * 0.8, cy - s * 0.55, s * 1.6, s * 1.2);
    x.fillRect(cx - s * 0.06, cy - s, s * 0.12, s * 0.45);
    x.fillStyle = PAL.ink;
    x.beginPath();
    x.arc(cx - s * 0.35, cy, s * 0.16, 0, Math.PI * 2);
    x.arc(cx + s * 0.35, cy, s * 0.16, 0, Math.PI * 2);
    x.fill();
  } else if (kind === 3) {
    // wifi
    for (let i = 1; i <= 3; i++) {
      x.beginPath();
      x.arc(cx, cy + s * 0.6, s * 0.4 * i, -Math.PI * 0.78, -Math.PI * 0.22);
      x.stroke();
    }
  } else {
    // roket
    x.beginPath();
    x.moveTo(cx, cy - s);
    x.quadraticCurveTo(cx + s * 0.5, cy - s * 0.2, cx + s * 0.3, cy + s * 0.6);
    x.lineTo(cx - s * 0.3, cy + s * 0.6);
    x.quadraticCurveTo(cx - s * 0.5, cy - s * 0.2, cx, cy - s);
    x.fill();
  }
  x.restore();
}

/** Origami turna: düz (kupür) hâli taban; katlanmış hâli ve kanat çırpışı göreli morph hedefleri.
 * Gövde elması, katlama çizgili iki kanat, uzun boyun + gagalı baş, sivri kuyruk. */
function craneGeometry() {
  type Vt = { f: [number, number]; c: [number, number, number]; up: number; inz: number };
  const v = (fx: number, fz: number, cx: number, cy: number, cz: number, up = 0, inz = 0): Vt => ({
    f: [fx, fz],
    c: [cx, cy, cz],
    up,
    inz,
  });
  const tris: Vt[] = [];
  for (const s of [-1, 1]) {
    const Nb = v(0.12, 0, 0.11, 0.03, 0);
    const Tb = v(-0.12, 0, -0.11, 0.03, 0);
    const K = v(0, 0, 0, -0.1, 0);
    const Ws = v(0, 0.07 * s, 0, 0.035, 0.045 * s);
    const Ns = v(0.15, 0.1 * s, 0.1, -0.02, 0.024 * s);
    const Ts = v(-0.15, 0.1 * s, -0.1, -0.02, 0.024 * s);
    const J = v(0.23, 0, 0.29, 0.27, 0);
    const Hs = v(0.25, 0.03 * s, 0.3, 0.255, 0.016 * s);
    const Bk = v(0.28, 0, 0.4, 0.2, 0);
    const Tt = v(-0.28, 0, -0.36, 0.25, 0);
    const Rf = v(0.14, 0.03 * s, 0.08, 0.035, 0.03 * s);
    const Rb = v(-0.14, 0.03 * s, -0.09, 0.035, 0.03 * s);
    const Ff = v(0.1, 0.16 * s, 0.07, 0.06, 0.19 * s, 0.09, 0.02 * s);
    const Fb = v(-0.11, 0.16 * s, -0.09, 0.06, 0.18 * s, 0.09, 0.02 * s);
    const Tip = v(0, 0.28 * s, 0, 0.09, 0.4 * s, 0.3, 0.07 * s);
    const Tip2 = v(-0.08, 0.2 * s, -0.12, 0.08, 0.34 * s, 0.26, 0.06 * s);
    tris.push(Nb, K, Ws, Tb, Ws, K); // gövde elması
    tris.push(Nb, Ns, J, J, Hs, Bk); // boyun, baş ve gaga katı
    tris.push(Tb, Ts, Tt); // kuyruk
    tris.push(Rf, Rb, Fb, Rf, Fb, Ff); // iç kanat
    tris.push(Ff, Fb, Tip, Fb, Tip2, Tip); // dış kanat (katlama çizgisinin ötesi), geniş uçlu
  }
  const n = tris.length;
  const flat = new Float32Array(n * 3);
  const crane = new Float32Array(n * 3);
  const flap = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  tris.forEach((t, i) => {
    flat.set([t.f[0], 0, t.f[1]], i * 3);
    crane.set([t.c[0] - t.f[0], t.c[1], t.c[2] - t.f[1]], i * 3);
    flap.set([0, t.up, -t.inz], i * 3);
    uv.set([(t.f[0] + 0.28) / 0.56, 1 - (t.f[1] + 0.28) / 0.56], i * 2);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(flat, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const tmp = new THREE.BufferGeometry();
  const abs = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) abs[i] = flat[i] + crane[i];
  tmp.setAttribute('position', new THREE.BufferAttribute(abs, 3));
  tmp.computeVertexNormals();
  const cn = tmp.getAttribute('normal').array as Float32Array;
  const fn = new Float32Array(n * 3);
  const dn = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    fn[i * 3 + 1] = 1;
    dn[i * 3] = cn[i * 3];
    dn[i * 3 + 1] = cn[i * 3 + 1] - 1;
    dn[i * 3 + 2] = cn[i * 3 + 2];
  }
  g.setAttribute('normal', new THREE.BufferAttribute(fn, 3));
  g.morphAttributes.position = [new THREE.BufferAttribute(crane, 3), new THREE.BufferAttribute(flap, 3)];
  g.morphAttributes.normal = [new THREE.BufferAttribute(dn, 3), new THREE.BufferAttribute(new Float32Array(n * 3), 3)];
  g.morphTargetsRelative = true;
  return g;
}

export default function create(): Character {
  const group = new THREE.Group();
  const ball = new THREE.Group();
  group.add(ball);
  group.position.y = -0.16;

  // ---------- Dokular ----------
  const paperTex = canvasTexture(2048, 1024, (x, w, h) => {
    x.fillStyle = '#EFE8DC';
    x.fillRect(0, 0, w, h);
    const rows = [
      { y: 40, h: 300 },
      { y: 300, h: 330 },
      { y: 600, h: 320 },
      { y: 860, h: 200 },
      { y: -120, h: 200 },
    ];
    let seed = 1;
    for (const r of rows) {
      let px = -60 + (seed % 3) * 30;
      while (px < w) {
        const pw = 230 + ((seed * 37) % 7) * 18;
        const ang = (((seed * 53) % 9) - 4) * 0.018;
        x.save();
        x.translate(px + pw / 2, r.y + r.h / 2);
        x.rotate(ang);
        x.shadowColor = 'rgba(62,31,56,0.18)';
        x.shadowBlur = 10;
        x.shadowOffsetY = 4;
        x.fillStyle = '#fff';
        x.fillRect(-pw / 2, -r.h / 2, pw, r.h);
        x.shadowColor = 'transparent';
        x.translate(-pw / 2, -r.h / 2);
        drawPage(x, pw, r.h, seed, false);
        x.restore();
        px += pw - 18;
        seed++;
      }
    }
  });
  const pagesTex = canvasTexture(1024, 1024, (x) => {
    for (let i = 0; i < 4; i++) {
      x.save();
      x.translate((i % 2) * 512, Math.floor(i / 2) * 512);
      drawPage(x, 512, 512, [0, 2, 5, 7][i], true);
      x.restore();
    }
  });
  const clipTex = canvasTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#FFFFFF';
    x.fillRect(0, 0, w, h);
    // ince gazete sütunları her yerde (katlanınca da okunsun)
    x.fillStyle = 'rgba(62,31,56,0.22)';
    for (let r = 0; r < 26; r++)
      for (let c = 0; c < 4; c++) x.fillRect(14 + c * 60, 10 + r * 9.4, 50 - ((r * 7 + c) % 5) * 4, 3.5);
    x.strokeStyle = 'rgba(62,31,56,0.35)';
    x.lineWidth = 3;
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(w, h);
    x.moveTo(w, 0);
    x.lineTo(0, h);
    x.stroke();
    x.fillStyle = '#FFFFFF';
    x.fillRect(58, 70, 140, 120);
    x.save();
    x.translate(w / 2, h / 2);
    x.rotate(Math.PI / 2);
    x.translate(-w / 2, -h / 2);
    x.fillStyle = PAL.ink;
    x.textAlign = 'center';
    x.font = `900 30px ${SERIF}`;
    x.fillText('NEWS', w / 2, 92);
    x.fillStyle = PAL.coral;
    x.fillRect(70, 104, 116, 6);
    x.fillStyle = 'rgba(62,31,56,0.35)';
    for (let i = 0; i < 6; i++) {
      x.fillRect(64, 124 + i * 12, 60, 5);
      x.fillRect(132, 124 + i * 12, 60, 5);
    }
    x.fillStyle = PAL.sky;
    x.fillRect(100, 40, 56, 22);
    x.restore();
  });
  const liveTex = canvasTexture(128, 64, (x, w, h) => {
    x.fillStyle = PAL.coral;
    x.fillRect(0, 0, w, h);
    x.fillStyle = PAL.white;
    x.font = `900 36px ${SANS}`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('LIVE', w / 2 + 12, h / 2 + 2);
    x.beginPath();
    x.arc(18, h / 2, 8, 0, Math.PI * 2);
    x.fill();
  });

  // ---------- Malzemeler ----------
  const texMat = (map: THREE.Texture, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({
      map,
      roughness: 0.85,
      bumpMap: clayBump(),
      bumpScale: 0.45,
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: 0.06,
      ...o,
    });
  const mRibbon = clay(PAL.coral, { rough: 0.5 });
  const mRibbonDark = clay('#E0645A', { rough: 0.5 });
  const mCopper = clay(PAL.apricot, { rough: 0.55, side: THREE.DoubleSide });
  const mButter = clay(PAL.butter, { rough: 0.55 });
  const mCream = clay(PAL.cream);
  const mSteel = clay(PAL.steel, { rough: 0.5 });
  const mBlue = clay(PAL.periwinkle);
  const mTip = glow(PAL.mint, 1, false);
  const mLiveDot = glow('#FF5A5A', 1, false);
  const mBall = new THREE.MeshBasicMaterial({ color: PAL.butter });

  // ---------- Gazete küre ----------
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 44), texMat(paperTex));
  ball.add(sphere);

  // üstüne yapışmış, hafif kabarık büyük ön sayfalar
  {
    const parts: THREE.BufferGeometry[] = [];
    const defs = [
      // phi merkezi, theta merkezi, eğim, atlas hücresi
      [Math.PI * 0.5 + 0.35, Math.PI / 2 - 0.25, 0.12, 0],
      [Math.PI * 0.5 + 1.25, Math.PI / 2 + 0.3, -0.1, 1],
      [Math.PI * 1.5 + 0.2, Math.PI / 2 - 0.2, 0.08, 2],
      [Math.PI * 0.5 - 0.95, Math.PI / 2 + 0.38, -0.14, 3],
      [Math.PI * 1.0 + 0.4, Math.PI / 2 + 0.05, 0.1, 1],
      [Math.PI * 0.5 + 0.7, Math.PI / 2 + 0.55, 0.05, 2],
    ];
    const ax = new THREE.Vector3();
    defs.forEach(([pc, tc, tilt, cell], i) => {
      const pl = 0.62;
      const tl = 0.62;
      const g = new THREE.SphereGeometry(1.012 + i * 0.002, 14, 14, pc - pl / 2, pl, tc - tl / 2, tl);
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      const u0 = (cell % 2) * 0.5;
      const v0 = cell < 2 ? 0.5 : 0;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) * 0.5, v0 + uv.getY(k) * 0.5);
      // kendi merkez ekseni etrafında hafif eğ
      ax.set(-Math.cos(pc) * Math.sin(tc), Math.cos(tc), Math.sin(pc) * Math.sin(tc));
      g.applyMatrix4(new THREE.Matrix4().makeRotationAxis(ax, tilt));
      parts.push(g);
    });
    ball.add(new THREE.Mesh(mergeGeometries(parts), texMat(pagesTex, { side: THREE.DoubleSide })));
  }

  // ---------- Kurdele ----------
  const A0 = -0.18; // fiyonkun azimutu (önün biraz solu)
  const bowDir = new THREE.Vector3(Math.sin(A0), 0, Math.cos(A0));
  const merAxis = new THREE.Vector3(Math.cos(A0), 0, -Math.sin(A0));
  {
    const prof = [
      [0.99, -0.085],
      [1.028, -0.085],
      [1.044, -0.068],
      [1.05, 0],
      [1.044, 0.068],
      [1.028, 0.085],
      [0.99, 0.085],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const eq = new THREE.LatheGeometry(prof, 120);
    const mer = new THREE.LatheGeometry(prof, 120);
    mer.scale(1.014, 1.014, 1.014);
    mer.rotateX(Math.PI / 2);
    mer.rotateY(A0 + Math.PI / 2);
    ball.add(new THREE.Mesh(mergeGeometries([eq, mer]), clay(PAL.coral, { rough: 0.5, side: THREE.DoubleSide })));
  }

  // ---------- Fiyonk ----------
  const bow = new THREE.Group();
  bow.position.copy(bowDir).multiplyScalar(1.05);
  bow.lookAt(bowDir.clone().multiplyScalar(3));
  ball.add(bow);
  const loopPts = (s: number) =>
    [
      [0.03, 0.02],
      [0.14, 0.15],
      [0.3, 0.23],
      [0.44, 0.15],
      [0.46, 0.0],
      [0.36, -0.09],
      [0.18, -0.06],
      [0.05, -0.02],
    ].map(([px, py], i) => new THREE.Vector3(px * s, py, 0.05 + (i > 1 && i < 6 ? -0.03 : 0)));
  const loopGeo = (s: number) => {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPts(s), true), 64, 0.052, 12, true);
    g.scale(1, 1, 2.1);
    return g;
  };
  const loops = [-1, 1].map((s) => {
    const m = new THREE.Mesh(loopGeo(s), mRibbon);
    bow.add(m);
    return m;
  });
  const tailGeo = (s: number) => {
    const g = tube(
      [
        new THREE.Vector3(0.01 * s, -0.03, 0.1),
        new THREE.Vector3(0.045 * s, -0.16, 0.08),
        new THREE.Vector3(0.07 * s, -0.3, 0.04),
        new THREE.Vector3(0.09 * s, -0.42, -0.03),
      ],
      0.03,
      32,
      8,
    );
    g.scale(2.3, 1, 0.7);
    // ucu çatallı kurdele kesiği için küçük üçgen kertik: ucu hafif genişlet
    return g;
  };
  const tails = [-1, 1].map((s) => {
    const m = new THREE.Mesh(tailGeo(s), mRibbonDark);
    bow.add(m);
    return m;
  });
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), mRibbon);
  knot.scale.set(1.15, 1, 0.85);
  knot.position.z = 0.1;
  bow.add(knot);

  // ---------- Uydu çanağı ----------
  const dishBase = new THREE.Group();
  dishBase.position.y = 1.02;
  dishBase.scale.setScalar(0.88);
  ball.add(dishBase);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.1, 28), mBlue);
  base.position.y = 0.04;
  dishBase.add(base);
  const live = new THREE.Mesh(rbox(0.17, 0.085, 0.04, 0.02), mCream);
  live.position.set(0.0, 0.045, 0.19);
  live.rotation.x = -0.25;
  dishBase.add(live);
  const liveFace = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.072), new THREE.MeshBasicMaterial({ map: liveTex }));
  liveFace.position.z = 0.021;
  live.add(liveFace);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.32, 6), mSteel);
  antenna.position.set(-0.16, 0.2, -0.04);
  antenna.rotation.z = 0.25;
  dishBase.add(antenna);
  const antBall = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), mBall);
  antBall.position.set(-0.2, 0.36, -0.04);
  dishBase.add(antBall);

  const turret = new THREE.Group();
  turret.position.y = 0.1;
  dishBase.add(turret);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.12, 20), mButter);
  neck.position.y = 0.05;
  turret.add(neck);
  {
    const a1 = rbox(0.04, 0.2, 0.08, 0.02);
    a1.translate(-0.12, 0.17, 0);
    const a2 = rbox(0.04, 0.2, 0.08, 0.02);
    a2.translate(0.12, 0.17, 0);
    const cross = rbox(0.28, 0.05, 0.09, 0.02);
    cross.translate(0, 0.1, 0);
    turret.add(new THREE.Mesh(mergeGeometries([a1, a2, cross]), mBlue));
  }
  const tilt = new THREE.Group();
  tilt.position.y = 0.24;
  turret.add(tilt);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 12), mButter);
  axle.rotation.z = Math.PI / 2;
  tilt.add(axle);
  const DR = 0.36;
  {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const r = (i / 14) * DR;
      pts.push(new THREE.Vector2(Math.max(0.001, r), (r * r) / (DR * 1.1)));
    }
    const dg = new THREE.LatheGeometry(pts, 40);
    dg.translate(0, 0.05, 0);
    tilt.add(new THREE.Mesh(dg, mCopper));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.022, 8, 48), mButter);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.05 + (DR * DR) / (DR * 1.1);
    tilt.add(rim);
    const ridge = new THREE.Mesh(new THREE.TorusGeometry(DR * 0.55, 0.012, 6, 40), mButter);
    ridge.rotation.x = Math.PI / 2;
    ridge.position.y = 0.05 + (DR * 0.55) ** 2 / (DR * 1.1) + 0.005;
    tilt.add(ridge);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 16), mBlue);
    hub.position.y = 0.06;
    tilt.add(hub);
    const struts: THREE.BufferGeometry[] = [];
    const fy = 0.05 + 0.34;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      const rx = Math.cos(a) * DR * 0.95;
      const rz = Math.sin(a) * DR * 0.95;
      struts.push(
        tube(
          [new THREE.Vector3(rx, rim.position.y, rz), new THREE.Vector3(rx * 0.15, fy - 0.03, rz * 0.15)],
          0.009,
          4,
          5,
        ),
      );
    }
    tilt.add(new THREE.Mesh(mergeGeometries(struts), mSteel));
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.09, 14), mBlue);
    feed.position.y = fy;
    tilt.add(feed);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 14, 10), mTip);
    tip.position.y = fy - 0.055;
    tilt.add(tip);
  }
  const FEED_Y = 0.39;
  const pulses = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 6, 40), glow(PAL.mint, 0, false));
    m.rotation.x = Math.PI / 2;
    m.visible = false;
    tilt.add(m);
    return { m, u: -1 };
  });

  // ---------- Turnalar ----------
  const NC = 7;
  const NX = 3; // dürtmede ek turnalar
  const cGeo = craneGeometry();
  const cranes = new THREE.InstancedMesh(
    cGeo,
    texMat(clipTex, { side: THREE.DoubleSide, roughness: 0.9, emissiveIntensity: 0.1, bumpMap: null }),
    NC + NX,
  );
  cranes.frustumCulled = false;
  ball.add(cranes);
  const morphObj = new THREE.Mesh(cGeo);
  const inf = morphObj.morphTargetInfluences!;
  const tints = [
    '#FFB8CF',
    '#A8E8D4',
    '#FFDF8A',
    '#B5D3FF',
    '#D4C0FF',
    '#FFC79C',
    '#C6EDA8',
    '#FFB8CF',
    '#FFDF8A',
    '#A8E8D4',
  ];
  tints.forEach((c, i) => cranes.setColorAt(i, new THREE.Color(c)));

  // görevler: 0 dinlenme, sonra soyulma, katlanma, uçuş, iniş, açılma
  const D_PEEL = 0.55;
  const D_FOLD = 0.7;
  const D_LAND = 0.6;
  const D_OPEN = 0.55;
  const birds = Array.from({ length: NC + NX }, (_, i) => {
    const e = new THREE.Euler(0.25 + (i % 3) * 0.12 - 0.3 * (i % 2), i * 0.9, (i % 2 ? 1 : -1) * 0.2);
    return {
      q: new THREE.Quaternion().setFromEuler(e),
      phi: i * 2.1 + 0.4,
      phi1: 0,
      t: -(1 + i * 1.3), // negatif: dinlenme süresi
      fly: 5.6 + (i % 3) * 0.7,
      flapPh: i * 1.7,
      extra: i >= NC,
      on: i < NC,
      grow: i < NC ? 1 : 0,
    };
  });

  // ---------- Geçici ----------
  const M = new THREE.Matrix4();
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const P = new THREE.Vector3();
  const DIR = new THREE.Vector3();
  const TAN = new THREE.Vector3();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  const surf = (q: THREE.Quaternion, phi: number, dir: THREE.Vector3, tan: THREE.Vector3) => {
    dir.set(Math.cos(phi), 0, Math.sin(phi)).applyQuaternion(q);
    tan.set(-Math.sin(phi), 0, Math.cos(phi)).applyQuaternion(q);
  };

  const okSpot = (q: THREE.Quaternion, phi: number) => {
    DIR.set(Math.cos(phi), 0, Math.sin(phi)).applyQuaternion(q);
    return Math.abs(DIR.y) > 0.42 && Math.abs(DIR.dot(merAxis)) > 0.26 && DIR.y < 0.78 && DIR.distanceTo(bowDir) > 0.6;
  };

  const takeoff = (b: (typeof birds)[number]) => {
    let d = 3.6;
    for (let k = 0; k < 30 && !okSpot(b.q, b.phi + d); k++) d += 0.17;
    b.phi1 = b.phi + d;
    b.t = 0;
  };
  birds.forEach((b) => {
    for (let k = 0; k < 40 && !okSpot(b.q, b.phi); k++) b.phi += 0.17;
  });

  const pokeAnim = new OneShot(2.8);
  let clock = 0;
  let pulseT = 0;
  let pulseIdx = 0;
  let spin = 0;
  let yawScan = 0;
  let hov = 0;

  function firePulse() {
    const p = pulses[pulseIdx];
    pulseIdx = (pulseIdx + 1) % pulses.length;
    p.u = 0;
  }

  function update(s: CharacterState) {
    const dt = s.dt;
    const red = s.reduce;
    hov = s.hover;
    clock += dt;
    const t = clock;
    const pp = pokeAnim.tick(dt);
    const T = pp >= 0 ? pp * pokeAnim.dur : -1;
    const sp = red ? 0.3 : 1 + hov * 0.6;

    // top: süzülme ve hafif dönme
    ball.position.y = Math.sin(t * 0.9) * (red ? 0.01 : 0.04);
    ball.rotation.y = Math.sin(t * 0.21) * (red ? 0.05 : 0.22);
    ball.rotation.z = Math.sin(t * 0.6 + 1) * (red ? 0.005 : 0.025);
    let sq = 0;
    if (T >= 0) sq = Math.sin(Math.min(1, T / 0.9) * Math.PI * 3) * Math.exp(-T * 2.5) * 0.08;
    ball.scale.set(1 + sq * 0.6, 1 - sq, 1 + sq * 0.6);

    // çanak: tarama + dürtmede tam tur
    yawScan += dt * (0.45 + hov * 0.6) * (red ? 0.3 : 1);
    if (T >= 0) spin = ease.inOut(Math.min(1, T / 1.6)) * Math.PI * 4;
    else spin = damp(spin, Math.round(spin / (Math.PI * 2)) * Math.PI * 2, 3, dt);
    turret.rotation.y = Math.sin(yawScan) * 1.1 + Math.sin(yawScan * 2.3) * 0.2 + spin;
    tilt.rotation.x = 0.95 + Math.sin(t * 0.55) * 0.18 + (T >= 0 ? Math.sin(T * 9) * 0.15 * Math.exp(-T) : 0);
    (mTip as THREE.MeshBasicMaterial).color.setHSL(0.47, 0.6, 0.6 + 0.2 * Math.sin(t * 6));

    // nabız halkaları
    pulseT -= dt * (1 + hov * 1.2 + (T >= 0 ? 3 : 0));
    if (pulseT <= 0 && !red) {
      firePulse();
      pulseT = 0.75;
    }
    for (const p of pulses) {
      if (p.u < 0) continue;
      p.u += dt / 1.3;
      if (p.u >= 1) {
        p.u = -1;
        p.m.visible = false;
        continue;
      }
      const e = ease.out(p.u);
      p.m.visible = true;
      p.m.position.y = FEED_Y + 0.02 + e * 0.42;
      const r = 0.05 + e * 0.3;
      p.m.scale.set(r, r, r * 0.8);
      (p.m.material as THREE.MeshBasicMaterial).opacity = (1 - p.u) * (0.75 + s.night * 0.25);
    }

    // CANLI ışığı ve anten topu
    const blink = Math.sin(t * 4) > 0 ? 1 : 0.25;
    mLiveDot.opacity = blink;
    liveFace.material.color.setScalar(0.85 + blink * 0.15 + s.night * 0.1);
    mBall.color.set(Math.sin(t * 3 + 1) > 0.3 ? PAL.butter : PAL.apricot);

    // fiyonk: nefes alır; dürtmede çözülür, zıplar, yeniden bağlanır
    let open = 0;
    if (T >= 0) {
      if (T < 0.35) open = ease.out(T / 0.35);
      else if (T < 1.4) open = 1;
      else open = 1 - ease.outElastic((T - 1.4) / 1.4);
    }
    const br = Math.sin(t * 2) * 0.03 + hov * Math.sin(t * 9) * 0.05;
    loops.forEach((l, i) => {
      const sgn = i === 0 ? -1 : 1;
      l.rotation.z = sgn * (br - open * 0.9) + (open > 0 ? Math.sin(T * 14 + i) * 0.15 * open : 0);
      l.rotation.y = sgn * open * 0.5;
      const sc = 1 + Math.sin(t * 2 + i) * 0.025 + open * 0.15;
      l.scale.set(sc, sc, 1);
      l.position.x = sgn * open * 0.12;
    });
    tails.forEach((tl, i) => {
      const sgn = i === 0 ? -1 : 1;
      tl.rotation.z = sgn * (Math.sin(t * 1.7 + i * 2) * 0.06 + open * 1.1 + hov * Math.sin(t * 8 + i) * 0.08);
      tl.rotation.x = Math.sin(t * 1.3 + i) * 0.08 - open * 0.5;
    });
    knot.rotation.z = open * Math.sin(T * 12) * 0.4;
    knot.scale.set(1.15 - open * 0.25, 1 + open * 0.15, 0.85);
    bow.position.copy(bowDir).multiplyScalar(1.05 + open * 0.12);

    // turnalar
    if (T >= 0 && T - dt < 0) {
      // dürtme: dinlenen herkes havalansın, ek turnalar doğsun
      birds.forEach((b, i) => {
        if (b.extra) {
          b.on = true;
          b.grow = 0;
          b.phi = i * 1.9 + t;
          for (let k = 0; k < 40 && !okSpot(b.q, b.phi); k++) b.phi += 0.17;
          takeoff(b);
          b.t = D_PEEL * 0.6;
        } else if (b.t < 0) takeoff(b);
      });
    }
    const flapSp = (red ? 3 : 6.5) * (1 + hov * 0.5);
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      if (!b.on) {
        cranes.setMatrixAt(i, ZERO);
        continue;
      }
      if (b.t < 0) {
        b.t += dt * (red ? 0.4 : 1 + hov);
        if (b.t >= 0) takeoff(b);
      } else {
        b.t += dt * sp;
      }
      const tt = Math.max(0, b.t);
      const t1 = D_PEEL;
      const t2 = t1 + D_FOLD;
      const t3 = t2 + b.fly;
      const t4 = t3 + D_LAND;
      const t5 = t4 + D_OPEN;
      let fold = 0;
      let alt = 1.045;
      let lift = 0;
      let flap = 0;
      let phi = b.phi;
      let pitch = 0;
      let roll = 0;
      if (b.t < 0) {
        // dinlenme: hafif kıpırtı
        lift = Math.max(0, Math.sin(t * 1.3 + i)) * 0.02;
      } else if (tt < t1) {
        const u = tt / t1;
        lift = Math.sin(u * Math.PI * 0.5) * 0.08;
        pitch = Math.sin(u * Math.PI) * 0.5;
      } else if (tt < t2) {
        const u = (tt - t1) / D_FOLD;
        fold = ease.inOut(u);
        lift = 0.08 + u * 0.14;
        flap = Math.sin(u * Math.PI) * 0.3;
      } else if (tt < t3) {
        const u = (tt - t2) / b.fly;
        fold = 1;
        const e = u - Math.sin(u * Math.PI * 2) / (Math.PI * 2);
        phi = b.phi + (b.phi1 - b.phi) * e;
        lift = 0.22 + Math.sin(u * Math.PI) * 0.3;
        flap = Math.sin(t * flapSp + b.flapPh) * 0.85 + 0.15;
        pitch = Math.cos(u * Math.PI) * 0.18;
        roll = Math.sin(u * Math.PI * 2) * 0.35;
      } else if (tt < t4) {
        const u = (tt - t3) / D_LAND;
        phi = b.phi1;
        fold = 1;
        lift = 0.22 * (1 - ease.out(u));
        flap = Math.sin(t * flapSp * 1.4 + b.flapPh) * (1 - u) * 0.8;
      } else if (tt < t5) {
        const u = (tt - t4) / D_OPEN;
        phi = b.phi1;
        fold = 1 - ease.inOut(u);
        lift = 0;
      } else {
        // yeni yerinde dinlen
        b.phi = b.phi1;
        phi = b.phi;
        b.t = -(2.5 + ((i * 0.37 + t * 0.13) % 1) * 3);
        if (b.extra) {
          b.on = false;
          cranes.setMatrixAt(i, ZERO);
          continue;
        }
      }
      if (b.extra) b.grow = damp(b.grow, tt > t4 ? 0 : 1, tt > t4 ? 6 : 10, dt);
      surf(b.q, phi, DIR, TAN);
      // uçarken hız yönü
      X.copy(TAN);
      alt = 1.045 + lift;
      P.copy(DIR).multiplyScalar(alt);
      Y.copy(DIR);
      X.addScaledVector(Y, -X.dot(Y)).normalize();
      if (pitch !== 0) {
        X.addScaledVector(Y, pitch).normalize();
        Y.addScaledVector(X, -X.dot(Y)).normalize();
      }
      if (roll !== 0) {
        Z.crossVectors(X, Y);
        Y.multiplyScalar(Math.cos(roll)).addScaledVector(Z, Math.sin(roll));
      }
      Z.crossVectors(X, Y);
      const sc = (0.85 + fold * 0.17) * (b.extra ? b.grow : 1);
      M.makeBasis(X.multiplyScalar(sc), Y.multiplyScalar(sc), Z.multiplyScalar(sc));
      M.setPosition(P);
      cranes.setMatrixAt(i, M);
      inf[0] = fold;
      inf[1] = flap * fold;
      cranes.setMorphAt(i, morphObj);
    }
    cranes.instanceMatrix.needsUpdate = true;
    if (cranes.morphTexture) cranes.morphTexture.needsUpdate = true;
  }

  return {
    group,
    update,
    poke() {
      if (pokeAnim.on && pokeAnim.p < 0.8) return;
      pokeAnim.start();
      pulseT = 0;
    },
  };
}
