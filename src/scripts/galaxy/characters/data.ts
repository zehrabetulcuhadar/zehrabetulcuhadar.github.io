import * as THREE from 'three';
import {
  canvasTexture,
  clay,
  clayBump,
  damp,
  ease,
  OneShot,
  PAL,
  rbox,
  smooth,
  type Character,
  type CharacterState,
} from './kit';

/**
 * Data: disko topu gezegen. Fayansları minik kil kareler, tablo hücreleri ve veritabanı silindirleri.
 * Döner, fayanslar ışıltıyla parlar, bazıları sorgulanır gibi dışarı fırlayıp geri girer,
 * ışık hüzmeleri süpürür, yıldız parıltıları yanıp söner, halka boyunca veri satırları akar,
 * minik bir çubuk grafik ay ritimle zıplar. Dürtünce: disko modu.
 */

const TR = 0.935; // fayans tabanı yarıçapı

const _e = new THREE.Euler();
function frameQ(lat: number, lon: number, out: THREE.Quaternion) {
  _e.set(-lat, lon, 0, 'YXZ');
  return out.setFromEuler(_e);
}

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

/** Pahlı köşeli, yumuşak kenarlı kil fayans: taban z=0, üst z=h. */
function tileGeo(s: number, h: number, ch: number, b: number) {
  const k = s / 2;
  const P = [
    [k, -k + ch],
    [k, k - ch],
    [k - ch, k],
    [-k + ch, k],
    [-k, k - ch],
    [-k, -k + ch],
    [-k + ch, -k],
    [k - ch, -k],
  ];
  const N = P.length;
  const rings: [number, number][] = [
    [1 - b / k, h], // üst kenar (içe)
    [1 - (b * 0.3) / k, h - b * 0.55],
    [1, h * 0.45],
    [1, 0],
  ];
  const pos: number[] = [0, 0, h];
  const uv: number[] = [0.5, 0.5];
  for (const [sc, z] of rings)
    for (const [x, y] of P) {
      pos.push(x * sc, y * sc, z);
      uv.push((x * sc) / s + 0.5, (y * sc) / s + 0.5);
    }
  const idx: number[] = [];
  for (let i = 0; i < N; i++) idx.push(0, 1 + i, 1 + ((i + 1) % N));
  for (let r = 0; r < rings.length - 1; r++)
    for (let i = 0; i < N; i++) {
      const i1 = (i + 1) % N;
      const a = 1 + r * N + i;
      const bb = 1 + (r + 1) * N + i;
      const c = 1 + (r + 1) * N + i1;
      const d = 1 + r * N + i1;
      idx.push(a, bb, c, a, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function atlasPatch(m: THREE.Material, key: string) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCell;').replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
#ifdef USE_MAP
vMapUv = vMapUv * aCell.zw + aCell.xy;
#endif`,
    );
  };
  m.customProgramCacheKey = () => key;
}

const COLS = [PAL.coral, PAL.butter, PAL.mint, PAL.sky, PAL.lilac, PAL.leaf, PAL.pink, PAL.periwinkle, PAL.apricot];

export default function create(): Character {
  const group = new THREE.Group();
  const swing = new THREE.Group(); // hafif sarkaç salınımı (askı noktası tepede)
  swing.position.y = 1.05;
  group.add(swing);
  const hang = new THREE.Group();
  hang.position.y = -1.05;
  swing.add(hang);
  const ball = new THREE.Group();
  hang.add(ball);
  const rand = rng(11);

  // ---------- çekirdek: fayans araları sıcak ışık ----------
  const coreMat = new THREE.MeshStandardMaterial({
    color: '#FFE6CC',
    emissive: '#FFC79A',
    emissiveIntensity: 0.35,
    roughness: 0.9,
    bumpMap: clayBump(),
    bumpScale: 0.4,
  });
  ball.add(new THREE.Mesh(new THREE.SphereGeometry(0.94, 40, 24), coreMat));

  // ---------- fayans atlası (düz, tablo, LED, satırlar) ----------
  const atlas = canvasTexture(512, 512, (x) => {
    for (let i = 0; i < 4; i++) {
      const X = (i % 2) * 256;
      const Y = Math.floor(i / 2) * 256;
      const g = x.createRadialGradient(X + 90, Y + 80, 10, X + 128, Y + 128, 190);
      g.addColorStop(0, '#FFFFFF');
      g.addColorStop(1, '#E4E0E8');
      x.fillStyle = g;
      x.fillRect(X, Y, 256, 256);
      const ink = 'rgba(62,31,56,0.30)';
      x.save();
      x.translate(X, Y);
      if (i === 1) {
        // tablo hücreleri
        x.fillStyle = 'rgba(255,255,255,0.75)';
        x.fillRect(46, 46, 164, 164);
        x.strokeStyle = ink;
        x.lineWidth = 9;
        x.beginPath();
        for (let k = 0; k <= 3; k++) {
          x.moveTo(46 + k * 54.7, 46);
          x.lineTo(46 + k * 54.7, 210);
          x.moveTo(46, 46 + k * 54.7);
          x.lineTo(210, 46 + k * 54.7);
        }
        x.stroke();
        x.fillStyle = 'rgba(62,31,56,0.22)';
        x.fillRect(50, 50, 47, 47);
        x.fillRect(105, 50, 47, 47);
        x.fillRect(159, 50, 47, 47);
      } else if (i === 2) {
        // sunucu LED'leri
        for (let k = 0; k < 3; k++) {
          x.fillStyle = '#FFFFFF';
          x.beginPath();
          x.arc(78 + k * 50, 96, 17, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = ink;
        x.beginPath();
        x.roundRect(62, 150, 132, 18, 9);
        x.fill();
        x.beginPath();
        x.roundRect(62, 182, 90, 18, 9);
        x.fill();
      } else if (i === 3) {
        // satırlar
        for (let k = 0; k < 4; k++) {
          x.fillStyle = k === 0 ? 'rgba(62,31,56,0.38)' : ink;
          x.beginPath();
          x.roundRect(58, 64 + k * 36, k === 0 ? 140 : 100 + ((k * 23) % 40), 18, 9);
          x.fill();
        }
      }
      x.restore();
    }
  });
  const cellOf = (i: number) => [(i % 2) / 2, 1 - (Math.floor(i / 2) + 1) / 2, 0.5, 0.5];

  // ---------- fayans yerleşimi ----------
  type Tile = { lat: number; lon: number; n: THREE.Vector3; kind: number; base: THREE.Color; ph: number; pop: number };
  const tiles: Tile[] = [];
  type Stack = { lat: number; lon: number; n: THREE.Vector3; col: THREE.Color; ph: number; q: number };
  const stacks: Stack[] = [];
  const STEP = 0.19;
  let ti = 0;
  for (let lat = -1.33; lat <= 1.34; lat += STEP) {
    const n = Math.max(7, Math.floor((2 * Math.PI * Math.cos(lat)) / STEP));
    const off = rand() * 6;
    for (let i = 0; i < n; i++) {
      const lon = off + (i / n) * Math.PI * 2;
      const nn = new THREE.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      const c = new THREE.Color(COLS[Math.floor(rand() * COLS.length)]).lerp(new THREE.Color('#FFFFFF'), 0.12);
      ti++;
      if (Math.abs(lat) < 1.15 && ti % 10 === 4) {
        stacks.push({ lat, lon, n: nn, col: c, ph: rand() * 10, q: 0 });
        continue;
      }
      const r = rand();
      const kind = r < 0.64 ? 0 : r < 0.78 ? 1 : r < 0.9 ? 2 : 3;
      tiles.push({ lat, lon, n: nn, kind, base: c, ph: rand() * 10, pop: 0 });
    }
  }
  const NT = tiles.length;
  const tGeo = tileGeo(0.152, 0.05, 0.03, 0.018);
  const cells = new Float32Array(NT * 4);
  tiles.forEach((t, i) => cells.set(cellOf(t.kind), i * 4));
  tGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 4));
  const tileMat = new THREE.MeshStandardMaterial({
    map: atlas,
    roughness: 0.7,
    metalness: 0,
    bumpMap: clayBump(),
    bumpScale: 0.35,
    emissive: '#ffffff',
    emissiveIntensity: 0.04,
  });
  atlasPatch(tileMat, 'data-atlas');
  const tileMesh = new THREE.InstancedMesh(tGeo, tileMat, NT);
  tileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ball.add(tileMesh);
  const tq: THREE.Quaternion[] = tiles.map((t) => frameQ(t.lat, t.lon, new THREE.Quaternion()));

  // ---------- veritabanı silindirleri (3 diskli yığın) ----------
  const DH = 0.04;
  const DR = 0.07;
  const disc = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, -DH / 2),
      new THREE.Vector2(DR * 0.86, -DH / 2),
      new THREE.Vector2(DR, 0),
      new THREE.Vector2(DR * 0.86, DH / 2),
      new THREE.Vector2(0, DH / 2),
    ],
    12,
  );
  disc.rotateX(Math.PI / 2); // eksen +z (normal yönü)
  const NS = stacks.length;
  const discMesh = new THREE.InstancedMesh(disc, clay(PAL.white), NS * 3);
  discMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const sq: THREE.Quaternion[] = stacks.map((s) => frameQ(s.lat, s.lon, new THREE.Quaternion()));
  const col = new THREE.Color();
  const white = new THREE.Color('#FFFFFF');
  stacks.forEach((s, i) => {
    for (let k = 0; k < 3; k++) discMesh.setColorAt(i * 3 + k, col.copy(s.col).lerp(white, k * 0.12));
  });
  ball.add(discMesh);
  // her yığının altında koyu bir yuva
  const sockGeo = tileGeo(0.16, 0.012, 0.035, 0.006);
  const sockMesh = new THREE.InstancedMesh(sockGeo, clay('#6E5A86'), NS);
  const m1 = new THREE.Matrix4();
  const m2 = new THREE.Matrix4();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const q1 = new THREE.Quaternion();
  const s1 = new THREE.Vector3(1, 1, 1);
  stacks.forEach((s, i) => {
    m1.compose(v1.copy(s.n).multiplyScalar(TR), sq[i], s1);
    sockMesh.setMatrixAt(i, m1);
  });
  ball.add(sockMesh);

  // ---------- askı başlığı ----------
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.1, 24), clay(PAL.steel));
  cap.position.y = 0.95;
  hang.add(cap);
  const capRim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.018, 8, 28), clay('#B4B9C8'));
  capRim.rotation.x = Math.PI / 2;
  capRim.position.y = 0.91;
  hang.add(capRim);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 20), clay(PAL.steel));
  loop.position.y = 1.05;
  hang.add(loop);

  // ---------- ışık hüzmeleri ----------
  const beamTex = canvasTexture(4, 128, (x, w, h) => {
    const g = x.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  const BL = 0.85;
  const beamGeo = new THREE.CylinderGeometry(0.15, 0.025, BL, 18, 1, true);
  beamGeo.translate(0, BL / 2, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    map: beamTex,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    opacity: 0.6,
  });
  const NBM = 7;
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, NBM);
  const beamCols = [PAL.mint, PAL.pink, PAL.butter, PAL.sky, PAL.lilac, PAL.apricot, PAL.leaf];
  for (let i = 0; i < NBM; i++) beams.setColorAt(i, col.set(beamCols[i]));
  beams.frustumCulled = false;
  hang.add(beams);

  // ---------- parıltılar ----------
  const starTex = canvasTexture(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#fff';
    for (const [w, l] of [
      [5, 62],
      [3, 40],
    ]) {
      x.save();
      x.translate(64, 64);
      if (l === 40) x.rotate(Math.PI / 4);
      x.beginPath();
      x.moveTo(0, -l);
      x.quadraticCurveTo(w, -w, l, 0);
      x.quadraticCurveTo(w, w, 0, l);
      x.quadraticCurveTo(-w, w, -l, 0);
      x.quadraticCurveTo(-w, -w, 0, -l);
      x.fill();
      x.restore();
    }
  });
  const NSP = 16;
  const sparkMat = new THREE.MeshBasicMaterial({
    map: starTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), sparkMat, NSP);
  sparks.frustumCulled = false;
  const sparkPos: { p: THREE.Vector3; ph: number; sp: number; s: number }[] = [];
  for (let i = 0; i < NSP; i++) {
    const a = rand() * Math.PI * 2;
    const y = (rand() - 0.5) * 1.6;
    const r = i < 6 ? 1.04 : 1.3 + rand() * 0.45;
    const p = new THREE.Vector3(Math.cos(a), y / r, Math.sin(a)).normalize().multiplyScalar(r);
    sparkPos.push({ p, ph: rand() * 10, sp: 0.6 + rand() * 0.9, s: i < 2 ? 0.42 : i < 6 ? 0.26 : 0.2 + rand() * 0.14 });
    sparks.setColorAt(i, col.set(i < 2 ? '#FFE79A' : i % 3 === 0 ? '#FFD45C' : i % 3 === 1 ? '#5FE0CF' : '#FF8CC6'));
  }
  hang.add(sparks);

  // ---------- halkalar + akan veri satırları ----------
  const ringA = new THREE.Group();
  ringA.rotation.set(1.25, 0.15, 0.25);
  hang.add(ringA);
  const ringB = new THREE.Group();
  ringB.rotation.set(1.75, -0.3, -0.35);
  hang.add(ringB);
  const RA = 1.42;
  const RB = 1.6;
  const ringMatA = new THREE.MeshBasicMaterial({
    color: PAL.mint,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const ringMatB = new THREE.MeshBasicMaterial({
    color: PAL.apricot,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
  ringA.add(new THREE.Mesh(new THREE.TorusGeometry(RA, 0.008, 6, 160), ringMatA));
  ringB.add(new THREE.Mesh(new THREE.TorusGeometry(RB, 0.006, 6, 160), ringMatB));
  const NR = 20;
  const rowGeo = rbox(0.15, 0.05, 0.035, 0.018, 1);
  const rowMesh = new THREE.InstancedMesh(rowGeo, clay(PAL.white, { emissive: 0.15 }), NR);
  rowMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < NR; i++) rowMesh.setColorAt(i, col.set(COLS[(i * 2) % COLS.length]));
  ringA.add(rowMesh);
  // satır üzerindeki minik hücre noktaları (dokulu yüz)
  const rowFaceTex = canvasTexture(128, 48, (x) => {
    x.fillStyle = 'rgba(255,255,255,0.0)';
    x.fillRect(0, 0, 128, 48);
    x.fillStyle = 'rgba(255,255,255,0.9)';
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      x.roundRect(10 + k * 39, 14, 30, 20, 6);
      x.fill();
    }
  });
  const rowFace = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.13, 0.04),
    new THREE.MeshBasicMaterial({ map: rowFaceTex, transparent: true, depthWrite: false, opacity: 0.85 }),
    NR,
  );
  ringA.add(rowFace);

  // ---------- çubuk grafik ay ----------
  const moonOrbit = new THREE.Group();
  moonOrbit.rotation.set(0.35, 0, -0.2);
  hang.add(moonOrbit);
  const moon = new THREE.Group();
  moon.scale.setScalar(1.25);
  moonOrbit.add(moon);
  const mBase = new THREE.Mesh(rbox(0.34, 0.05, 0.16, 0.025, 2), clay(PAL.lilac));
  moon.add(mBase);
  const NBAR = 5;
  const barMesh = new THREE.InstancedMesh(rbox(1, 1, 1, 0.25, 1), clay(PAL.white, { emissive: 0.12 }), NBAR);
  const barCols = [PAL.coral, PAL.butter, PAL.mint, PAL.sky, PAL.pink];
  for (let i = 0; i < NBAR; i++) barMesh.setColorAt(i, col.set(barCols[i]));
  moon.add(barMesh);
  const MR = 1.56;

  // ---------- durum ----------
  const pk = new OneShot(3);
  let spin = 0;
  let spinV = 0.35;
  let hov = 0;
  let popTimer = 0;
  let beamA = 0;
  let streamA = 0;
  let moonA = 0.6;
  const camQ = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const H1 = new THREE.Vector3();
  const H2 = new THREE.Vector3();
  const nw = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  const Z = new THREE.Vector3(0, 0, 1);
  const sc = new THREE.Vector3();

  function poke() {
    pk.start();
  }

  function update(s: CharacterState) {
    const dt = s.dt;
    const t = s.t;
    const sp = s.reduce ? 0.25 : 1;
    hov = damp(hov, s.hover, 6, dt);
    const night = s.night;
    const P = pk.tick(dt);
    const disco = P >= 0 ? Math.sin(Math.min(1, P * 1.1) * Math.PI) : 0; // 0→1→0
    const beat = Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 2 * (P >= 0 ? 2.4 : 1.6)), 6);

    // dönüş + sarkaç
    spinV = damp(spinV, (0.35 + hov * 0.35 + disco * 2.6) * sp, 4, dt);
    spin += spinV * dt;
    ball.rotation.y = spin;
    swing.rotation.z = 0.035 * Math.sin(t * 0.8 * sp) + disco * 0.05 * Math.sin(t * 9);
    swing.rotation.x = 0.02 * Math.sin(t * 0.55 * sp + 1);
    const pulse = 1 + beat * (0.006 + disco * 0.02);
    ball.scale.setScalar(pulse);
    coreMat.emissiveIntensity = 0.3 + night * 0.45 + beat * 0.08 + disco * 0.35;

    // parıltı noktaları (disko topunun ışık yansımaları)
    H1.set(Math.sin(t * 0.5) * 0.5 - 0.35, 0.45, 1).normalize();
    H2.set(0.8, Math.sin(t * 0.37) * 0.6 - 0.1, 0.6).normalize();
    const cs = Math.cos(spin);
    const sn = Math.sin(spin);

    // sorgu taraması (yukarı-aşağı gezen parlak bant)
    const scan = Math.sin(t * 0.45 * sp) * 1.15;

    // rastgele fayans "sorgulanır": dışarı fırlar
    popTimer -= dt * (1 + hov * 2.5 + disco * 4) * sp;
    if (popTimer <= 0 && !s.reduce) {
      popTimer = 0.18;
      tiles[Math.floor(rand() * NT)].pop = 1;
    }

    for (let i = 0; i < NT; i++) {
      const tl = tiles[i];
      // dünya normali (y ekseni dönüşü)
      nw.set(tl.n.x * cs + tl.n.z * sn, tl.n.y, -tl.n.x * sn + tl.n.z * cs);
      const g1 = Math.pow(Math.max(0, nw.dot(H1)), 50);
      const g2 = Math.pow(Math.max(0, nw.dot(H2)), 70);
      const tw = Math.pow(Math.max(0, Math.sin(t * 1.3 + tl.ph * 7)), 40) * 0.6;
      const sb = Math.exp(-Math.pow((tl.lat - scan) / 0.12, 2));
      let lift = 0;
      if (tl.pop > 0) {
        tl.pop = Math.max(0, tl.pop - dt * 1.4);
        lift += Math.sin(tl.pop * Math.PI) * 0.09;
      }
      lift += sb * 0.015;
      let wave = 0;
      if (P >= 0) {
        // disko modu: kuzeyden güneye iki dalga
        const ph = P * 2.6 * Math.PI * 2 - (1.4 - tl.lat) * 3.2;
        wave = Math.max(0, Math.sin(ph)) * smooth(0, 0.1, P) * (1 - smooth(0.85, 1, P));
        lift += wave * 0.07;
      }
      m1.compose(v1.copy(tl.n).multiplyScalar(TR + lift), tq[i], s1);
      tileMesh.setMatrixAt(i, m1);
      const glint = Math.min(1, g1 + g2 + tw + (tl.pop > 0 ? Math.sin(tl.pop * Math.PI) * 0.6 : 0));
      const br = 0.94 + sb * 0.2 + wave * 0.35 + night * 0.08;
      col
        .copy(tl.base)
        .multiplyScalar(br)
        .lerp(white, glint * 0.85);
      if (wave > 0) col.offsetHSL(0, 0.05 * wave, 0);
      tileMesh.setColorAt(i, col);
    }
    tileMesh.instanceMatrix.needsUpdate = true;
    if (tileMesh.instanceColor) tileMesh.instanceColor.needsUpdate = true;

    // veritabanı yığınları: arada bir sorgulanır (diskler ayrılır), disko modunda dağılıp toplanır
    for (let i = 0; i < NS; i++) {
      const st = stacks[i];
      const qcyc = (t * 0.22 + st.ph) % 4;
      let gap = qcyc < 1 ? Math.sin(qcyc * Math.PI) * 0.02 : 0;
      let rise = 0;
      let rot = 0;
      if (P >= 0) {
        const lp = Math.min(1, Math.max(0, (P - 0.05 - (i % 7) * 0.03) / 0.8));
        const up = Math.sin(lp * Math.PI);
        gap += up * 0.055;
        rise = up * 0.05;
        rot = ease.inOut(lp) * Math.PI * 2;
      }
      for (let k = 0; k < 3; k++) {
        const h = 0.006 + DH / 2 + k * (DH + 0.004 + gap) + rise;
        q1.setFromAxisAngle(Z, rot * (k % 2 ? -1 : 1));
        q2.copy(sq[i]).multiply(q1);
        m1.compose(v1.copy(st.n).multiplyScalar(TR + h), q2, s1);
        discMesh.setMatrixAt(i * 3 + k, m1);
      }
    }
    discMesh.instanceMatrix.needsUpdate = true;

    // hüzmeler
    beamA -= dt * (0.5 + hov * 0.4 + disco * 3.5) * sp;
    const add = night > 0.5;
    if ((beamMat.blending === THREE.AdditiveBlending) !== add) {
      beamMat.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending;
      sparkMat.blending = beamMat.blending;
    }
    beamMat.opacity = (add ? 0.5 : 0.28) + hov * 0.12 + disco * 0.3;
    for (let i = 0; i < NBM; i++) {
      const a = beamA + (i / NBM) * Math.PI * 2;
      const el = 0.55 * Math.sin(i * 1.7 + t * 0.4 * sp);
      v1.set(Math.cos(el) * Math.sin(a), Math.sin(el), Math.cos(el) * Math.cos(a));
      q1.setFromUnitVectors(Y, v1);
      const len = 0.85 + 0.15 * Math.sin(t * 2 + i) + disco * 0.15;
      const flick = 0.85 + 0.15 * Math.sin(t * 7 + i * 3);
      m1.compose(v2.copy(v1).multiplyScalar(0.97), q1, sc.set(flick, Math.min(len, 1), flick));
      beams.setMatrixAt(i, m1);
    }
    beams.instanceMatrix.needsUpdate = true;

    // yıldız parıltıları (kameraya bakar)
    s.camera.getWorldQuaternion(camQ);
    hang.getWorldQuaternion(parentQ).invert().multiply(camQ);
    for (let i = 0; i < NSP; i++) {
      const p = sparkPos[i];
      const tw = i < 2 ? 0.55 + 0.45 * beat : Math.pow(Math.max(0, Math.sin(t * p.sp * 2 + p.ph)), 8);
      const k =
        p.s * (tw * (0.8 + hov * 0.4 + night * 0.3) + disco * (i < 2 ? 0.15 : 0.6 + 0.4 * Math.sin(t * 12 + i)));
      q1.setFromAxisAngle(Z, t * 0.6 + i);
      q2.copy(parentQ).multiply(q1);
      if (i === 0) v1.copy(H1).multiplyScalar(1.03);
      else if (i === 1) v1.copy(H2).multiplyScalar(1.03);
      else v1.copy(p.p).multiplyScalar(1 + disco * 0.08);
      m1.compose(v1, q2, sc.setScalar(Math.max(1e-4, k)));
      sparks.setMatrixAt(i, m1);
    }
    sparks.instanceMatrix.needsUpdate = true;

    // halkalar + veri akışı
    ringA.rotation.z += dt * 0.08 * sp;
    ringB.rotation.z -= dt * 0.12 * sp;
    ringMatA.opacity = 0.45 + night * 0.3 + disco * 0.3;
    ringMatB.opacity = 0.35 + night * 0.3 + disco * 0.3;
    streamA += dt * (0.35 + hov * 0.4 + disco * 1.5) * sp;
    for (let i = 0; i < NR; i++) {
      const a = streamA + (i / NR) * Math.PI * 2;
      const gapHide = (i % 7 === 3 ? 0 : 1) * (1 + 0.15 * beat);
      v1.set(Math.cos(a) * RA, Math.sin(a) * RA, 0);
      q1.setFromAxisAngle(Z, a + Math.PI / 2);
      m1.compose(v1, q1, sc.setScalar(Math.max(1e-4, gapHide)));
      rowMesh.setMatrixAt(i, m1);
      m2.makeTranslation(0, 0, 0.019);
      m1.multiply(m2);
      rowFace.setMatrixAt(i, m1);
    }
    rowMesh.instanceMatrix.needsUpdate = true;
    rowFace.instanceMatrix.needsUpdate = true;

    // çubuk grafik ay
    moonA += dt * (0.3 + hov * 0.2 + disco * 0.8) * sp;
    moon.position.set(Math.cos(moonA) * MR, 0, Math.sin(moonA) * MR);
    moon.rotation.y = -moonA + Math.PI / 2 + 0.3 * Math.sin(t * 0.7);
    moon.rotation.z = 0.12 * Math.sin(t * 1.1);
    for (let i = 0; i < NBAR; i++) {
      const b =
        0.05 +
        0.07 * (0.5 + 0.5 * Math.sin(t * (1.3 + i * 0.37) * sp + i * 1.9)) +
        beat * 0.05 * ((i + 1) % 2) +
        disco * 0.08 * Math.abs(Math.sin(t * 8 + i));
      m1.compose(v1.set(-0.12 + i * 0.06, 0.025 + b / 2, 0), q1.identity(), sc.set(0.042, b, 0.07));
      barMesh.setMatrixAt(i, m1);
    }
    barMesh.instanceMatrix.needsUpdate = true;
  }

  return { group, update, poke };
}
