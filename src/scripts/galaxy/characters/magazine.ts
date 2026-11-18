import * as THREE from 'three';
import { mergeGeometries as mergeRaw } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import {
  clay,
  glow,
  rbox,
  tube,
  canvasTexture,
  damp,
  smooth,
  ease,
  OneShot,
  PAL,
  clayBump,
  type Character,
  type CharacterState,
} from './kit';

/**
 * Dergi gezegeni: renkli edebiyat dergilerinden üst üste dizilmiş kubbe biçimli bir "pasta".
 * Tepesinde kitap sehpasında açık duran bir dergi (sayfaları kendiliğinden çevrilir), onu aydınlatan
 * bir okuma lambası, çay fincanı, kalem; etrafında çırpınan sayfalardan bir halka.
 * Dürtünce: dergi ardına kadar açılır, sayfalar yelpaze gibi akar, birkaç sayfa uçup halkaya katılır, lamba göz kırpar.
 */

const COLORS = [PAL.coral, PAL.butter, PAL.pink, PAL.mint, PAL.leaf, PAL.periwinkle, PAL.lilac, PAL.apricot, PAL.sky];
const Y0 = -0.14; // tüm gövdeyi biraz aşağı al (lamba yukarıda yer kaplıyor)
const TOP = 0.565; // dergi yığınının üst yüzü (yerel)

/* ---------- dokular ---------- */

const TITLES: [string, string, string][] = [
  ['NESİR', PAL.coral, PAL.cream],
  ['Mürekkep', PAL.mint, PAL.ink],
  ['LİRİK', PAL.periwinkle, PAL.cream],
  ['Kıyı', PAL.butter, PAL.ink],
  ['ÖYKÜ', PAL.pink, PAL.ink],
  ['Ada', PAL.lilac, PAL.cream],
  ['PAGES', PAL.apricot, PAL.ink],
  ['Şiir & Ses', PAL.sky, PAL.ink],
];

function coverAtlas() {
  const cw = 200,
    ch = 256;
  return canvasTexture(cw * 4, ch * 2, (x) => {
    TITLES.forEach(([title, bg, fg], i) => {
      const ox = (i % 4) * cw,
        oy = Math.floor(i / 4) * ch;
      x.save();
      x.translate(ox, oy);
      x.fillStyle = bg;
      x.fillRect(0, 0, cw, ch);
      x.strokeStyle = 'rgba(255,255,255,0.55)';
      x.lineWidth = 4;
      x.strokeRect(8, 8, cw - 16, ch - 16);
      x.fillStyle = fg;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = `900 ${title.length > 6 ? 30 : 40}px Georgia, 'Times New Roman', serif`;
      x.fillText(title, cw / 2, 40);
      x.font = '600 13px system-ui, sans-serif';
      x.fillText(`SAYI ${12 + i * 7}  ·  EDEBİYAT`, cw / 2, 70);
      const cx = cw / 2,
        cy = 150;
      const accent = COLORS[(i * 3 + 2) % COLORS.length];
      const accent2 = COLORS[(i * 5 + 4) % COLORS.length];
      x.fillStyle = accent;
      switch (i % 4) {
        case 0:
          x.beginPath();
          x.arc(cx - 18, cy, 42, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = accent2;
          x.fillRect(cx + 2, cy - 30, 48, 60);
          break;
        case 1:
          x.beginPath();
          x.moveTo(cx, cy - 50);
          x.lineTo(cx + 52, cy + 40);
          x.lineTo(cx - 52, cy + 40);
          x.fill();
          x.fillStyle = accent2;
          x.beginPath();
          x.arc(cx, cy + 10, 20, 0, Math.PI * 2);
          x.fill();
          break;
        case 2:
          x.beginPath();
          x.arc(cx, cy, 44, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = bg;
          x.beginPath();
          x.arc(cx + 20, cy - 10, 38, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = accent2;
          for (let k = 0; k < 4; k++) {
            x.beginPath();
            x.arc(cx + 30 + k * 9, cy + 30 - k * 14, 4, 0, Math.PI * 2);
            x.fill();
          }
          break;
        default:
          x.lineWidth = 10;
          x.strokeStyle = accent;
          for (let k = 0; k < 3; k++) {
            x.beginPath();
            x.arc(cx, cy + 20 + k * 6, 30 + k * 16, Math.PI * 1.1, Math.PI * 1.9);
            x.stroke();
          }
          x.fillStyle = accent2;
          x.beginPath();
          x.arc(cx, cy - 26, 14, 0, Math.PI * 2);
          x.fill();
      }
      x.fillStyle = fg;
      x.globalAlpha = 0.7;
      x.fillRect(20, 214, 90, 6);
      x.fillRect(20, 226, 64, 6);
      x.globalAlpha = 1;
      x.fillStyle = '#fff';
      x.fillRect(cw - 62, 206, 44, 32);
      x.fillStyle = PAL.ink;
      for (let k = 0; k < 12; k++) x.fillRect(cw - 58 + k * 3.3, 210, k % 3 ? 1.4 : 2.4, 22);
      x.restore();
    });
  });
}

function pageTexture() {
  return canvasTexture(256, 320, (x, w, h) => {
    x.fillStyle = PAL.paper;
    x.fillRect(0, 0, w, h);
    x.fillStyle = PAL.coral;
    x.fillRect(28, 26, 120, 14);
    x.fillStyle = PAL.sky;
    x.fillRect(28, 56, 92, 74);
    x.fillStyle = PAL.butter;
    x.beginPath();
    x.arc(96, 78, 13, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = PAL.leaf;
    x.beginPath();
    x.moveTo(28, 130);
    x.lineTo(64, 92);
    x.lineTo(100, 130);
    x.fill();
    x.fillStyle = 'rgba(62,31,56,0.45)';
    for (let r = 0; r < 7; r++) x.fillRect(132, 58 + r * 11, 88 - ((r * 13) % 30), 5);
    for (let r = 0; r < 14; r++) x.fillRect(28, 146 + r * 11, 200 - ((r * 37) % 60), 5);
    x.fillStyle = PAL.lilac;
    x.fillRect(28, 146, 14, 16);
  });
}

/* ---------- yardımcılar ---------- */

/** İndeksli/indekssiz karışık geometrileri güvenle birleştirir (yalnız position/normal/uv). */
function mergeGeometries(list: THREE.BufferGeometry[]) {
  const norm = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(n.attributes))
      if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
    return n;
  });
  return mergeRaw(norm)!;
}

const _o = new THREE.Object3D();
function setM(
  m: THREE.InstancedMesh,
  i: number,
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number,
  s = 1,
  order: THREE.EulerOrder = 'YXZ',
) {
  _o.position.set(px, py, pz);
  _o.rotation.set(rx, ry, rz, order);
  _o.scale.setScalar(s);
  _o.updateMatrix();
  m.setMatrixAt(i, _o.matrix);
}

/** Az üçgenli pahlı kutu (birim boyut): yüzlerce dergi için ucuz ama yumuşak kenarlı. */
function chamferBox(c = 0.1) {
  const pts: THREE.Vector3[] = [];
  const a = 0.5,
    b = 0.5 - c;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        pts.push(new THREE.Vector3(sx * a, sy * b, sz * b));
        pts.push(new THREE.Vector3(sx * b, sy * a, sz * b));
        pts.push(new THREE.Vector3(sx * b, sy * b, sz * a));
      }
  return new ConvexGeometry(pts);
}

/** Basit sözde-rastgele (her yüklemede aynı görünüm). */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function create(): Character {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = Y0;
  group.add(body);
  const rand = rng(7);

  /* ---------- 1. dergi yığını (kubbe) ---------- */
  const H = 0.085;
  const D = 0.42;
  const rOf = (y: number) => Math.sqrt(Math.max(0, 1 - y * y));
  type Mag = { x: number; y: number; z: number; ry: number; rz: number; w: number; fore: boolean; col: string };
  const mags: Mag[] = [];
  for (let k = 0, y = -0.86; y < 0.53; k++, y += 0.1) {
    const r = Math.max(0.42, rOf(y));
    const n = Math.max(6, Math.round((Math.PI * 2 * r) / 0.34));
    const off = (k * 0.37) % 1;
    for (let j = 0; j < n; j++) {
      const phi = ((j + off) / n) * Math.PI * 2 + (rand() - 0.5) * 0.06;
      const rr = r - D / 2 + (rand() - 0.5) * 0.035;
      mags.push({
        x: Math.cos(phi) * rr,
        y: y + (rand() - 0.5) * 0.008,
        z: Math.sin(phi) * rr,
        ry: -phi + (rand() - 0.5) * 0.12,
        rz: (rand() - 0.5) * 0.05,
        w: ((Math.PI * 2 * r) / n) * (0.93 + rand() * 0.06),
        fore: rand() < 0.36,
        col: COLORS[Math.floor(rand() * COLORS.length)],
      });
    }
  }
  const nM = mags.length;
  const slabs = new THREE.InstancedMesh(chamferBox(), clay('#ffffff', { emissive: 0.03 }), nM);
  const leaves = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clay('#F4E8D4'), nM);
  const nLabels = mags.filter((m) => !m.fore).length;
  const labels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clay(PAL.cream), nLabels);
  const nTabs = mags.filter((m, i) => m.fore && i % 3 === 0).length;
  const tabs = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), clay('#ffffff', { emissive: 0.05 }), nTabs);
  const c = new THREE.Color();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _v = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const place = (m: Mag, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number) => {
    _e.set(0, m.ry, m.rz, 'YXZ');
    _q.setFromEuler(_e);
    _v.set(lx, ly, lz)
      .applyQuaternion(_q)
      .add(_s.set(m.x, m.y, m.z));
    _m.compose(_v, _q, _s.set(sx, sy, sz));
    return _m;
  };
  let li = 0,
    ti = 0;
  mags.forEach((m, i) => {
    slabs.setMatrixAt(i, place(m, 0, 0, 0, D, H, m.w));
    slabs.setColorAt(i, c.set(m.col));
    leaves.setMatrixAt(i, place(m, m.fore ? 0.012 : -0.02, 0, 0, D, H * 0.62, m.w * 0.94));
    if (!m.fore) {
      labels.setMatrixAt(li++, place(m, D / 2 + 0.002, 0, (i % 2 ? 1 : -1) * m.w * 0.12, 0.012, H * 0.42, m.w * 0.42));
    } else if (i % 3 === 0) {
      tabs.setMatrixAt(ti, place(m, D / 2 + 0.035, H * 0.18, m.w * 0.25, 0.08, 0.008, 0.06));
      tabs.setColorAt(ti++, c.set(COLORS[(i * 7) % COLORS.length]));
    }
  });
  body.add(slabs, leaves, labels, tabs);

  // iç çekirdek (boşlukları kapatır)
  const prof: THREE.Vector2[] = [new THREE.Vector2(0.001, -0.95)];
  for (let y = -0.95; y <= TOP - 0.01; y += 0.05) prof.push(new THREE.Vector2(Math.max(0.05, rOf(y) - 0.07), y));
  prof.push(new THREE.Vector2(rOf(TOP) - 0.07, TOP - 0.005));
  prof.push(new THREE.Vector2(0.001, TOP - 0.005));
  body.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 40), clay('#EADCC6')));
  // tepe: dantel örtü
  const doilyTex = canvasTexture(256, 256, (x, w) => {
    x.clearRect(0, 0, w, w);
    x.fillStyle = PAL.cream;
    x.beginPath();
    for (let a = 0; a <= 200; a++) {
      const t = (a / 200) * Math.PI * 2;
      const rr = w * 0.44 + Math.sin(t * 24) * w * 0.035;
      x.lineTo(w / 2 + Math.cos(t) * rr, w / 2 + Math.sin(t) * rr);
    }
    x.fill();
    x.fillStyle = PAL.pink;
    x.globalAlpha = 0.5;
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      x.beginPath();
      x.arc(w / 2 + Math.cos(t) * w * 0.38, w / 2 + Math.sin(t) * w * 0.38, 5, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = PAL.pink;
    x.lineWidth = 3;
    x.beginPath();
    x.arc(w / 2, w / 2, w * 0.3, 0, Math.PI * 2);
    x.stroke();
  });
  const doily = new THREE.Mesh(
    new THREE.CircleGeometry(0.62, 40),
    new THREE.MeshStandardMaterial({ map: doilyTex, transparent: true, roughness: 0.9, alphaTest: 0.3 }),
  );
  doily.rotation.x = -Math.PI / 2;
  doily.position.y = TOP + 0.004;
  body.add(doily);

  /* ---------- 2. kenara yaslanmış kapaklı dergiler ---------- */
  const NC = 12;
  const CW = 0.3,
    CH = 0.38;
  const backs = new THREE.InstancedMesh(
    rbox(CW + 0.02, CH + 0.02, 0.035, 0.012, 1),
    clay('#ffffff', { emissive: 0.03 }),
    NC - 1,
  );
  const fronts: THREE.BufferGeometry[] = [];
  const obj = new THREE.Object3D();
  obj.rotation.order = 'YXZ';
  for (let i = 0, bi = 0; i < NC; i++) {
    if (i === 7) continue; // lambanın ayağı burada
    const phi = (i / NC) * Math.PI * 2 + 0.26;
    const front = Math.sin(phi); // +1 önde
    const alpha = 0.3 + 0.8 * Math.pow((1 - front) * 0.5, 0.8) + (rand() - 0.5) * 0.08; // yataydan yatıklık
    const r0 = 0.83;
    obj.rotation.set(-(Math.PI / 2 - alpha), Math.PI / 2 - phi + (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12);
    const up = new THREE.Vector3(0, 1, 0).applyEuler(obj.rotation);
    obj.position.set(Math.cos(phi) * r0, TOP + 0.01, Math.sin(phi) * r0).addScaledVector(up, CH / 2 + 0.01);
    obj.updateMatrix();
    backs.setMatrixAt(bi, obj.matrix);
    const ti2 = i % TITLES.length;
    backs.setColorAt(bi++, c.set(TITLES[ti2][1]).multiplyScalar(0.85));
    const pg = new THREE.PlaneGeometry(CW, CH);
    const uv = pg.attributes.uv as THREE.BufferAttribute;
    const u0 = (ti2 % 4) / 4,
      v0 = 1 - (Math.floor(ti2 / 4) + 1) / 2;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, u0 + uv.getX(k) / 4, v0 + uv.getY(k) / 2);
    pg.translate(0, 0, 0.019);
    pg.applyMatrix4(obj.matrix);
    fronts.push(pg);
  }
  const frontMesh = new THREE.Mesh(
    mergeGeometries(fronts),
    new THREE.MeshStandardMaterial({ map: coverAtlas(), roughness: 0.75, bumpMap: clayBump(), bumpScale: 0.3 }),
  );
  body.add(backs, frontMesh);

  /* ---------- 3. kitap sehpası + açık dergi ---------- */
  const hero = new THREE.Group();
  const TILT = 0.58;
  const PW = 0.5,
    PH = 0.64;
  hero.position.set(0.02, TOP + 0.13 + Math.sin(TILT) * 0.37, -0.02);
  hero.rotation.x = TILT;
  body.add(hero);
  const heroPivot = new THREE.Group(); // dürtmede zıplama için
  hero.add(heroPivot);
  const standGeo = mergeGeometries([
    rbox(1.12, 0.035, 0.74, 0.015, 2).translate(0, -0.035, 0),
    rbox(1.14, 0.07, 0.045, 0.02, 2).translate(0, -0.01, 0.37),
    new THREE.CylinderGeometry(0.018, 0.018, 0.6, 8).rotateX(-0.9).translate(-0.4, -0.25, -0.2),
    new THREE.CylinderGeometry(0.018, 0.018, 0.6, 8).rotateX(-0.9).translate(0.4, -0.25, -0.2),
  ]);
  hero.add(new THREE.Mesh(standGeo, clay(PAL.cocoa)));
  const coverGeo = rbox(PW, 0.014, PH, 0.006, 1).translate(PW / 2, 0, 0);
  const backCover = new THREE.Mesh(coverGeo, clay(PAL.coral));
  backCover.position.y = -0.006;
  const frontPivot = new THREE.Group();
  const frontCover = new THREE.Mesh(coverGeo, clay(PAL.coral));
  frontPivot.add(frontCover);
  frontPivot.position.y = -0.004;
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, PH, 10).rotateX(Math.PI / 2), clay(PAL.coral));
  spine.position.y = -0.008;
  heroPivot.add(backCover, frontPivot, spine);
  const inner = new THREE.Mesh(
    new THREE.PlaneGeometry(PW * 0.96, PH * 0.96),
    clay(PAL.cream, { side: THREE.DoubleSide }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.set(PW / 2, 0.0085, 0);
  frontCover.add(inner);

  // sayfalar: tek geometri, her kare tepe noktaları güncellenir
  const NP = 10;
  const NU = 10;
  const vPer = (NU + 1) * 2;
  const pPos = new Float32Array(NP * vPer * 3);
  const pNor = new Float32Array(NP * vPer * 3);
  const pUv = new Float32Array(NP * vPer * 2);
  const pIdx: number[] = [];
  for (let p = 0; p < NP; p++) {
    for (let u = 0; u <= NU; u++)
      for (let v = 0; v < 2; v++) {
        const k = p * vPer + u * 2 + v;
        pUv[k * 2] = u / NU;
        pUv[k * 2 + 1] = v;
      }
    for (let u = 0; u < NU; u++) {
      const a = p * vPer + u * 2;
      pIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const pageGeo = new THREE.BufferGeometry();
  pageGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pageGeo.setAttribute('normal', new THREE.BufferAttribute(pNor, 3));
  pageGeo.setAttribute('uv', new THREE.BufferAttribute(pUv, 2));
  pageGeo.setIndex(pIdx);
  const pageTex = pageTexture();
  const pageMesh = new THREE.Mesh(
    pageGeo,
    new THREE.MeshStandardMaterial({
      map: pageTex,
      emissiveMap: pageTex,
      emissive: '#ffffff',
      emissiveIntensity: 0.22,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  );
  pageMesh.frustumCulled = false;
  heroPivot.add(pageMesh);
  const pTheta = new Float32Array(NP);
  const pDir = new Float32Array(NP);
  const pW = new Float32Array(NP);
  for (let p = 0; p < NP; p++) pW[p] = PW * (0.97 - (p % 3) * 0.008);
  function writePage(p: number, th: number, curl: number) {
    const w = pW[p];
    const cc = (Math.abs(curl) < 1e-4 ? 1e-4 : curl) / w;
    const st = Math.sin(th),
      ct = Math.cos(th);
    const lift = 0.003 + p * 0.0005;
    for (let u = 0; u <= NU; u++) {
      const s = (u / NU) * w;
      const a = th + cc * s;
      const x = (Math.sin(a) - st) / cc;
      const y = (ct - Math.cos(a)) / cc + lift;
      const nx = -Math.sin(a),
        ny = Math.cos(a);
      for (let v = 0; v < 2; v++) {
        const k = (p * vPer + u * 2 + v) * 3;
        pPos[k] = x;
        pPos[k + 1] = y;
        pPos[k + 2] = (0.5 - v) * PH * 0.95;
        pNor[k] = nx;
        pNor[k + 1] = ny;
        pNor[k + 2] = 0;
      }
    }
  }
  // kurdele ayraç
  const ribbon = new THREE.Mesh(
    tube(
      [
        new THREE.Vector3(0.0, 0.01, -PH * 0.45),
        new THREE.Vector3(0.02, 0.012, 0),
        new THREE.Vector3(0.0, 0.01, PH * 0.48),
        new THREE.Vector3(0.03, -0.06, PH * 0.53),
        new THREE.Vector3(0.05, -0.16, PH * 0.53),
      ],
      0.008,
      30,
      6,
    ),
    clay(PAL.coral, { emissive: 0.15 }),
  );
  heroPivot.add(ribbon);

  /* ---------- 4. okuma lambası ---------- */
  const lamp = new THREE.Group();
  body.add(lamp);
  const brass = clay(PAL.apricot, { rough: 0.5 });
  const LB = new THREE.Vector3(-0.45, TOP, -0.45);
  const elbow = new THREE.Vector3(-0.52, TOP + 0.64, -0.52);
  const headP = new THREE.Vector3(-0.12, TOP + 0.88, -0.2);
  const lampBase = new THREE.Mesh(
    mergeGeometries([
      new THREE.CylinderGeometry(0.13, 0.15, 0.05, 24).translate(0, 0.025, 0),
      new THREE.CylinderGeometry(0.05, 0.07, 0.05, 16).translate(0, 0.07, 0),
    ]),
    clay(PAL.mint),
  );
  lampBase.position.copy(LB);
  const arm = new THREE.Mesh(
    mergeGeometries([tube([LB.clone().setY(LB.y + 0.08), elbow], 0.018, 8, 8), tube([elbow, headP], 0.016, 8, 8)]),
    brass,
  );
  const joints = new THREE.Mesh(
    mergeGeometries([
      new THREE.SphereGeometry(0.04, 14, 10).translate(LB.x, LB.y + 0.09, LB.z),
      new THREE.SphereGeometry(0.045, 14, 10).translate(elbow.x, elbow.y, elbow.z),
      new THREE.SphereGeometry(0.035, 14, 10).translate(headP.x, headP.y, headP.z),
      new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8).rotateZ(Math.PI / 2).translate(elbow.x, elbow.y, elbow.z),
    ]),
    clay(PAL.mint),
  );
  const coil: THREE.Vector3[] = [];
  const a0 = LB.clone().setY(LB.y + 0.16),
    a1 = elbow.clone().lerp(LB, 0.2);
  const dir = a1.clone().sub(a0);
  const side1 = new THREE.Vector3(1, 0, 0).cross(dir).normalize().multiplyScalar(0.03);
  const side2 = dir.clone().cross(side1).normalize().multiplyScalar(0.03);
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    const an = t * Math.PI * 2 * 9;
    coil.push(
      a0.clone().addScaledVector(dir, t).addScaledVector(side1, Math.cos(an)).addScaledVector(side2, Math.sin(an)),
    );
  }
  const spring = new THREE.Mesh(tube(coil, 0.005, 160, 4), clay(PAL.steel, { rough: 0.4 }));
  lamp.add(lampBase, arm, joints, spring);
  const head = new THREE.Group();
  head.position.copy(headP);
  const target = new THREE.Vector3(0.04, TOP + 0.26, 0.06);
  head.lookAt(target); // ebeveynsiz iken: yerel koordinatlarda
  lamp.add(head);
  const shadeGeo = new THREE.SphereGeometry(0.17, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
  shadeGeo.rotateX(-Math.PI / 2);
  const shade = new THREE.Mesh(shadeGeo, clay(PAL.mint, { side: THREE.DoubleSide }));
  shade.position.z = 0.1;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.014, 8, 32), clay(PAL.butter));
  rim.position.z = 0.1;
  const capKnob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), brass);
  capKnob.position.z = -0.08;
  const bulbMat = (clay('#FFE9A8', { emissive: 1.2 }) as THREE.MeshStandardMaterial).clone();
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), bulbMat);
  bulb.position.z = 0.1;
  const glowTex = canvasTexture(128, 128, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,240,200,1)');
    g.addColorStop(0.35, 'rgba(255,214,140,0.45)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });
  const haloMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: '#FFD98A',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const halo = new THREE.Sprite(haloMat);
  halo.position.z = 0.16;
  halo.scale.setScalar(0.6);
  const coneLen = headP.distanceTo(target);
  const coneGeo = new THREE.CylinderGeometry(0.15, 0.5, coneLen, 32, 1, true);
  coneGeo.rotateX(-Math.PI / 2); // dar uç abajurda, geniş uç sayfada
  coneGeo.translate(0, 0, coneLen / 2 + 0.1);
  const coneMat = glow('#FFD58A', 0.12);
  coneMat.side = THREE.DoubleSide;
  const cone = new THREE.Mesh(coneGeo, coneMat);
  head.add(shade, rim, capKnob, bulb, halo, cone);
  const poolMat = glow('#FFE2A0', 0.2);
  poolMat.map = glowTex;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0, 0.03, 0);
  heroPivot.add(pool);

  /* ---------- 5. çay fincanı + buhar, kalem ---------- */
  const cup = new THREE.Group();
  cup.position.set(0.5, TOP, 0.12);
  body.add(cup);
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.025, 24), clay(PAL.cream));
  saucer.position.y = 0.012;
  const cupM = new THREE.Mesh(
    mergeGeometries([
      new THREE.CylinderGeometry(0.085, 0.06, 0.11, 20, 1, true).translate(0, 0.08, 0),
      new THREE.CylinderGeometry(0.06, 0.06, 0.01, 20).translate(0, 0.03, 0),
      new THREE.TorusGeometry(0.035, 0.012, 8, 14, Math.PI * 1.3).rotateZ(-Math.PI * 0.65).translate(0.09, 0.085, 0),
    ]),
    clay(PAL.pink, { side: THREE.DoubleSide }),
  );
  const tea = new THREE.Mesh(
    new THREE.CircleGeometry(0.078, 20).rotateX(-Math.PI / 2),
    clay(PAL.cocoa, { emissive: 0.15 }),
  );
  tea.position.y = 0.12;
  cup.add(saucer, cupM, tea);
  const NS = 4;
  const steam = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 10, 8), clay(PAL.white, { opacity: 0.55 }), NS);
  steam.frustumCulled = false;
  cup.add(steam);
  const pencil = new THREE.Mesh(
    mergeGeometries([
      new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6).rotateZ(Math.PI / 2),
      new THREE.ConeGeometry(0.018, 0.05, 6).rotateZ(-Math.PI / 2).translate(0.195, 0, 0),
    ]),
    clay(PAL.butter),
  );
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.04, 8).rotateZ(Math.PI / 2), clay(PAL.pink));
  eraser.position.x = -0.19;
  pencil.add(eraser);
  pencil.position.set(-0.46, TOP + 0.022, 0.28);
  pencil.rotation.y = 0.7;
  body.add(pencil);

  /* ---------- 6. sayfa halkası ---------- */
  const ring = new THREE.Group();
  ring.rotation.set(0.32, 0, 0.14);
  ring.position.y = -0.05;
  group.add(ring);
  const t1 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.008, 6, 120), clay(PAL.cream, { emissive: 0.2 }));
  const t2 = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.006, 6, 120), clay(PAL.lilac, { emissive: 0.2 }));
  t1.rotation.x = t2.rotation.x = Math.PI / 2;
  ring.add(t1, t2);
  const NW = 26;
  const NF = 5; // dürtmede uçup gelen sayfalar
  const NT = NW + NF;
  const wingGeo = new THREE.PlaneGeometry(0.12, 0.15).translate(0.06, 0, 0).rotateX(Math.PI / 2);
  const wingTex = canvasTexture(64, 80, (x, w) => {
    x.fillStyle = PAL.paper;
    x.fillRect(0, 0, w, 80);
    x.fillStyle = PAL.pink;
    x.fillRect(8, 8, 30, 8);
    x.fillStyle = PAL.sky;
    x.fillRect(8, 22, 22, 18);
    x.fillStyle = 'rgba(62,31,56,0.28)';
    for (let r = 0; r < 3; r++) x.fillRect(34, 24 + r * 6, w - 44, 3);
    for (let r = 0; r < 4; r++) x.fillRect(8, 48 + r * 7, w - 16 - ((r * 9) % 14), 3);
  });
  const wingMat = new THREE.MeshStandardMaterial({ map: wingTex, side: THREE.DoubleSide, roughness: 0.9 });
  const wingL = new THREE.InstancedMesh(wingGeo, wingMat, NT);
  const wingR = new THREE.InstancedMesh(wingGeo, wingMat, NT);
  const spines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.016, 0.016, 0.155),
    clay('#ffffff', { emissive: 0.1 }),
    NT,
  );
  wingL.frustumCulled = wingR.frustumCulled = spines.frustumCulled = false;
  ring.add(wingL, wingR, spines);
  const wAng = new Float32Array(NT),
    wRad = new Float32Array(NT),
    wY = new Float32Array(NT),
    wPh = new Float32Array(NT),
    wSp = new Float32Array(NT);
  for (let i = 0; i < NT; i++) {
    wAng[i] = (i / NT) * Math.PI * 2 + rand() * 0.15;
    wRad[i] = 1.48 + rand() * 0.24;
    wY[i] = (rand() - 0.5) * 0.12;
    wPh[i] = rand() * 6.28;
    wSp[i] = 0.8 + rand() * 0.6;
    spines.setColorAt(i, c.set(COLORS[i % COLORS.length]));
  }
  const flyP = new Float32Array(NF).fill(-1); // <0 gizli/bekliyor, 0..1 uçuş, ≥1 halkada
  const flyLife = new Float32Array(NF).fill(99);

  /* ---------- durum ---------- */
  const shot = new OneShot(2.8);
  let hov = 0,
    flipClock = 0,
    leftCount = 4,
    flipDir = 1,
    ringRot = 0,
    armed = false;
  for (let p = 0; p < NP; p++) pTheta[p] = p < leftCount ? Math.PI - 0.02 : 0.02;
  const ringInv = new THREE.Matrix4();
  const tmpA = new THREE.Vector3();

  function update(s: CharacterState) {
    const dt = s.dt;
    const t = s.t;
    const red = s.reduce ? 0.2 : 1;
    hov = damp(hov, s.hover, 6, dt);
    const nightK = s.night;
    const pp = shot.tick(dt);
    const on = pp >= 0;
    const P = on ? pp : 0;

    // gövde: hafif salınım ve nefes
    group.rotation.y = Math.sin(t * 0.23) * 0.22 * red;
    body.position.y = Y0 + Math.sin(t * 1.1) * 0.015 * red;
    heroPivot.position.y = on ? Math.sin(Math.min(1, P / 0.18) * Math.PI) * 0.06 : 0;

    /* sayfa çevirme döngüsü */
    if (!s.reduce && !on) {
      flipClock += dt * (1 + hov * 1.6);
      if (flipClock > 2.4) {
        flipClock = 0;
        leftCount += flipDir;
        if (leftCount >= NP - 2) flipDir = -1;
        if (leftCount <= 2) flipDir = 1;
      }
    }
    const fanW = on ? smooth(0.03, 0.2, P) * (1 - smooth(0.62, 0.95, P)) : 0;
    for (let p = 0; p < NP; p++) {
      const idleT = p < leftCount ? Math.PI - 0.025 - (leftCount - 1 - p) * 0.006 : 0.025 + (p - leftCount) * 0.006;
      const before = pTheta[p];
      pTheta[p] = damp(pTheta[p], idleT, 3.2 * (1 + hov * 0.6), dt);
      let th = pTheta[p];
      const vel = (th - before) / Math.max(dt, 1e-4);
      pDir[p] = damp(pDir[p], Math.max(-1, Math.min(1, vel * 0.8)), 8, dt);
      let curl = -pDir[p] * 1.1 * Math.sin(th);
      if (fanW > 0) {
        const base = 0.25 + (p / (NP - 1)) * (Math.PI - 0.5);
        const wave = Math.sin(P * 18 - p * 0.7) * 0.22 * smooth(0.15, 0.3, P);
        th = th + (base + wave - th) * fanW;
        curl = curl * (1 - fanW) - Math.cos(P * 18 - p * 0.7) * 0.6 * fanW;
      }
      writePage(p, th, curl);
    }
    pageGeo.attributes.position.needsUpdate = true;
    pageGeo.attributes.normal.needsUpdate = true;
    frontPivot.rotation.z = Math.PI - 0.01 - (on ? Math.sin(Math.min(1, P / 0.35) * Math.PI) * 0.5 : 0);

    /* lamba */
    const blink = on && P < 0.35 ? (Math.floor(P * 30) % 2 === 0 ? 0.15 : 1) : 1;
    const flick = 1 + Math.sin(t * 13.7) * 0.02 + Math.sin(t * 5.1) * 0.02;
    const boost = on && P > 0.35 ? 1 + 0.4 * (1 - smooth(0.35, 0.9, P)) : 1;
    const L = blink * flick * (0.85 + nightK * 0.5 + hov * 0.25) * boost;
    bulbMat.emissiveIntensity = 0.6 + L * 0.9;
    haloMat.opacity = Math.min(1, 0.35 + L * 0.45);
    halo.scale.setScalar(0.45 + L * 0.25);
    coneMat.opacity = (0.05 + nightK * 0.08 + hov * 0.04) * L;
    poolMat.opacity = (0.12 + nightK * 0.25) * L;
    head.rotation.z = Math.sin(t * 0.7) * 0.03 * red;

    /* buhar */
    for (let i = 0; i < NS; i++) {
      const ph = (t * 0.45 * red + i / NS) % 1;
      const sc = (0.5 + ph * 1.1) * Math.sin(ph * Math.PI);
      setM(
        steam,
        i,
        Math.sin(ph * 6 + i) * 0.03,
        0.15 + ph * 0.32,
        Math.cos(ph * 5 + i * 2) * 0.02,
        0,
        0,
        0,
        Math.max(0.001, sc),
      );
    }
    steam.instanceMatrix.needsUpdate = true;

    /* halka */
    ringRot += dt * (0.12 + hov * 0.25 + (on ? 0.6 * Math.sin(P * Math.PI) : 0)) * (s.reduce ? 0.3 : 1);
    if (armed) {
      armed = false;
      for (let f = 0; f < NF; f++) {
        flyP[f] = -0.35 - 0.14 * f; // sırayla çıkar (yelpaze açıldıktan sonra)
        flyLife[f] = 0;
      }
    }
    group.updateMatrixWorld();
    ringInv.copy(ring.matrixWorld).invert();
    for (let i = 0; i < NT; i++) {
      const f = i - NW;
      let scale = 1;
      const a = wAng[i] + ringRot * wSp[i] * 0.9;
      const flap = Math.sin(t * (5 + hov * 4) * wSp[i] + wPh[i]) * (0.5 + hov * 0.3) * red;
      const open = 1.0 + flap;
      let px = Math.cos(a) * wRad[i],
        py = wY[i] + Math.sin(t * 1.3 + wPh[i]) * 0.04 * red,
        pz = Math.sin(a) * wRad[i];
      let roll = Math.sin(t * 0.9 + wPh[i]) * 0.3;
      if (f >= 0) {
        if (flyLife[f] > 50) scale = 0;
        else {
          flyP[f] += dt / 0.9;
          const k = flyP[f];
          if (k < 0) scale = 0;
          else if (k < 1) {
            const e = ease.inOut(k);
            tmpA
              .set(PW * 0.5, 0.1, 0)
              .applyMatrix4(heroPivot.matrixWorld)
              .applyMatrix4(ringInv);
            px = tmpA.x + (px - tmpA.x) * e;
            pz = tmpA.z + (pz - tmpA.z) * e;
            py = tmpA.y + (py - tmpA.y) * e + Math.sin(e * Math.PI) * 0.45;
            roll += (1 - e) * 6;
            scale = 1.8 - e * 0.6;
          } else {
            flyLife[f] += dt;
            scale = 1.2 * (1 - smooth(5, 7, flyLife[f]));
            if (flyLife[f] > 7) flyLife[f] = 99;
          }
        }
      }
      scale = Math.max(0.0001, scale);
      setM(wingL, i, px, py, pz, roll, -a, Math.PI - open * 0.5, scale);
      setM(wingR, i, px, py, pz, roll, -a, open * 0.5, scale);
      setM(spines, i, px, py, pz, roll, -a, 0, scale);
    }
    wingL.instanceMatrix.needsUpdate = true;
    wingR.instanceMatrix.needsUpdate = true;
    spines.instanceMatrix.needsUpdate = true;
  }

  for (let p = 0; p < NP; p++) writePage(p, pTheta[p], 0);

  return {
    group,
    update,
    poke() {
      shot.start();
      armed = true;
    },
  };
}
