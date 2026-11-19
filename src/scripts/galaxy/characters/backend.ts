import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clay, glow, rbox, tube, canvasTexture, damp, smooth, ease, OneShot, PAL, type Character } from './kit';

/** Zaten indekssiz olan geometride three.js uyarı verir: yalnızca gerekirse çevir. */
const flat = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

/**
 * Backend: sıcak, steampunk makine dairesi gezegeni.
 * Ön yüzde birbirine gerçekten geçen dişliler (doğru oranlarla, ters yönlerde),
 * dişliye bağlı krank ve pompalayan piston, basınç göstergesi, ateşli kazan kapağı;
 * tepede LED'leri yanıp sönen küçük sunucu kuleleri; bacalardan buhar bulutları.
 */

type Part = { g: THREE.BufferGeometry; m: THREE.Matrix4 };

/** Aynı malzemeli statik parçaları tek çizim çağrısında birleştirir; frame ile yüzey koordinatlarında yerleştirir. */
class Baker {
  bins = new Map<THREE.Material, Part[]>();
  frame = new THREE.Matrix4();
  private tmp = new THREE.Object3D();
  put(
    mat: THREE.Material,
    g: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    s: number | [number, number, number] = 1,
  ) {
    const o = this.tmp;
    o.position.set(x, y, z);
    o.rotation.set(rx, ry, rz);
    if (typeof s === 'number') o.scale.setScalar(s);
    else o.scale.set(s[0], s[1], s[2]);
    o.updateMatrix();
    this.putM(mat, g, this.frame.clone().multiply(o.matrix));
  }
  putM(mat: THREE.Material, g: THREE.BufferGeometry, m: THREE.Matrix4) {
    let arr = this.bins.get(mat);
    if (!arr) this.bins.set(mat, (arr = []));
    arr.push({ g, m });
  }
  build(parent: THREE.Object3D) {
    for (const [mat, parts] of this.bins) {
      const gs = parts.map(({ g, m }) => {
        const x = g.index ? g.toNonIndexed() : g.clone();
        x.applyMatrix4(m);
        for (const k of Object.keys(x.attributes))
          if (k !== 'position' && k !== 'normal' && k !== 'uv') x.deleteAttribute(k);
        if (!x.attributes.uv)
          x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
        return x;
      });
      const merged = mergeGeometries(gs, false);
      if (merged) parent.add(new THREE.Mesh(merged, mat));
    }
    this.bins.clear();
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();

/** Yüzey çerçevesi: z = dışa doğru normal, y = "yukarı" ipucuna yakın. */
function frame(dir: THREE.Vector3, r: number, up = new THREE.Vector3(0, 1, 0)) {
  const z = dir.clone().normalize();
  let x = new THREE.Vector3().crossVectors(up, z);
  if (x.lengthSq() < 1e-4) x = new THREE.Vector3(1, 0, 0);
  x.normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  m.setPosition(z.clone().multiplyScalar(r));
  return m;
}

/** Dişli: diş merkezleri k*2π/N açısında. */
function gearGeo(N: number, m: number, depth: number, holes: number) {
  const r = (m * N) / 2;
  const ra = r + m * 0.95;
  const rf = r - m * 1.15;
  const p = (Math.PI * 2) / N;
  const s = new THREE.Shape();
  for (let k = 0; k < N; k++) {
    const a = k * p;
    const pts: [number, number][] = [
      [rf, a - p * 0.32],
      [ra, a - p * 0.17],
      [ra, a + p * 0.17],
      [rf, a + p * 0.32],
    ];
    pts.forEach(([rr, aa], i) => {
      const x = Math.cos(aa) * rr;
      const y = Math.sin(aa) * rr;
      if (k === 0 && i === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, Math.max(0.022, r * 0.16), 0, Math.PI * 2, true);
  s.holes.push(hole);
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2 + Math.PI / holes;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.009,
    bevelSegments: 2,
    curveSegments: 6,
  });
  return g;
}

export default function create(): Character {
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);

  // ---------- Renkler ----------
  const cBody = clay('#E3B48C');
  const cBodyDk = clay('#C9946E');
  const cCopper = clay('#D98757');
  const cBrass = clay('#E9B65A');
  const cSage = clay('#7FAE8E');
  const cRed = clay('#C9655A');
  const cBlue = clay('#7FA7C9');
  const cSlate = clay('#5A4A5E');
  const cFace = clay('#6A5468');
  const cDark = clay('#3E3346');
  const cCream = clay(PAL.cream);
  const cSteam = clay('#FFF6EC', { emissive: 0.2 });

  const R = 0.95;
  const bake = new Baker();

  const rivetG = new THREE.IcosahedronGeometry(0.018, 0);

  // ---------- Ön panel ----------
  const panel = new THREE.Group();
  const PDIR = V(0, 0.14, 1);
  const PF = frame(PDIR, 0);
  panel.quaternion.setFromRotationMatrix(PF);
  root.add(panel);
  const PR = 0.7;
  const PZ = 0.67;
  // gövde: ön kapağı kesik küre (düz panel oraya oturur)
  const bodyGeo = new THREE.SphereGeometry(R, 52, 32, 0, Math.PI * 2, Math.asin(PR / R) - 0.02, Math.PI);
  bodyGeo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), PDIR));
  root.add(new THREE.Mesh(bodyGeo, cBody));
  bake.frame.copy(PF);
  bake.put(cBodyDk, new THREE.CylinderGeometry(PR, PR, 0.1, 56), 0, 0, PZ - 0.05, Math.PI / 2);
  bake.put(cFace, new THREE.CylinderGeometry(PR - 0.06, PR - 0.06, 0.02, 56), 0, 0, PZ + 0.0, Math.PI / 2);
  bake.put(cCopper, new THREE.TorusGeometry(PR - 0.01, 0.045, 10, 64), 0, 0, PZ - 0.01);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    bake.put(cBrass, rivetG, Math.cos(a) * (PR - 0.02), Math.sin(a) * (PR - 0.02), PZ + 0.04);
  }

  // Dişliler (aynı modül: m), merkezler arası = rA + rB
  const M = 0.034;
  const GZ = PZ + 0.012;
  type Gear = { mesh: THREE.Mesh; N: number; x: number; y: number; r: number };
  const mkGear = (
    N: number,
    x: number,
    y: number,
    mat: THREE.Material,
    holes: number,
    parent: THREE.Object3D,
    mod = M,
  ) => {
    const mesh = new THREE.Mesh(gearGeo(N, mod, 0.04, holes), mat);
    mesh.position.set(x, y, GZ);
    parent.add(mesh);
    // göbek + cıvata (dişliyle döner)
    const hub = new THREE.Mesh(hubGeo, cBrass);
    hub.scale.setScalar(Math.max(0.6, (mod * N) / 2 / 0.27));
    mesh.add(hub);
    return { mesh, N, x, y, r: (mod * N) / 2 } as Gear;
  };
  const hubParts = [
    new THREE.CylinderGeometry(0.05, 0.055, 0.05, 18).rotateX(Math.PI / 2).translate(0, 0, 0.06),
    new THREE.CylinderGeometry(0.025, 0.025, 0.03, 6).rotateX(Math.PI / 2).translate(0, 0, 0.095),
  ].map((g) => g.toNonIndexed());
  const hubGeo = mergeGeometries(hubParts, false)!;

  const A = mkGear(16, -0.1, -0.05, cCopper, 5, panel);
  const tB = 0.35;
  const tC = 2.3;
  const rA = A.r;
  const rB = (M * 10) / 2;
  const rC = (M * 8) / 2;
  const B = mkGear(10, A.x + Math.cos(tB) * (rA + rB), A.y + Math.sin(tB) * (rA + rB), cRed, 0, panel);
  const C = mkGear(8, A.x + Math.cos(tC) * (rA + rC), A.y + Math.sin(tC) * (rA + rC), cSage, 0, panel);
  // Yan panel: ikinci dişli takımı (sağ-arka)
  const side = new THREE.Group();
  const SDIR = V(0.86, -0.05, -0.5);
  const SF = frame(SDIR, 0);
  side.quaternion.setFromRotationMatrix(SF);
  root.add(side);
  const SR = 0.33;
  const SZ = R + 0.03;
  bake.frame.copy(SF);
  bake.put(cBodyDk, new THREE.CylinderGeometry(SR, SR + 0.02, 0.16, 40), 0, 0, SZ - 0.08, Math.PI / 2);
  bake.put(cFace, new THREE.CylinderGeometry(SR - 0.03, SR - 0.03, 0.01, 40), 0, 0, SZ - 0.002, Math.PI / 2);
  bake.put(cCopper, new THREE.TorusGeometry(SR - 0.01, 0.03, 8, 40), 0, 0, SZ);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    bake.put(cBrass, rivetG, Math.cos(a) * (SR - 0.01), Math.sin(a) * (SR - 0.01), SZ + 0.03, 0, 0, 0, 0.8);
  }
  const SM = 0.026;
  const E = mkGear(12, -0.08, 0, cBrass, 4, side, SM);
  E.mesh.position.z = SZ + 0.005;
  const F = mkGear(7, -0.08 + (SM * 12) / 2 + (SM * 7) / 2, 0, cSage, 0, side, SM);
  F.mesh.position.z = SZ + 0.005;

  // Krank + biyel + piston (B dişlisine bağlı, dikey)
  const RP = 0.08;
  const LROD = 0.25;
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.08, 10).rotateX(Math.PI / 2), cBrass);
  pin.position.set(RP, 0, 0.075);
  B.mesh.add(pin);
  const rodGeo = rbox(0.035, 1, 0.025, 0.012, 2);
  const cSteel = clay(PAL.steel);
  const rod = new THREE.Mesh(rodGeo, cSteel);
  panel.add(rod);
  const housingY0 = 0.42;
  const housingY1 = 0.64;
  bake.frame.copy(PF);
  bake.put(
    cCopper,
    new THREE.CylinderGeometry(0.07, 0.07, housingY1 - housingY0, 20),
    B.x,
    (housingY0 + housingY1) / 2,
    GZ + 0.07,
  );
  bake.put(cBrass, new THREE.TorusGeometry(0.072, 0.014, 8, 20), B.x, housingY0 + 0.01, GZ + 0.07, Math.PI / 2);
  bake.put(cBrass, new THREE.TorusGeometry(0.072, 0.014, 8, 20), B.x, housingY1 - 0.02, GZ + 0.07, Math.PI / 2);
  bake.put(cBrass, new THREE.SphereGeometry(0.075, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), B.x, housingY1, GZ + 0.07);
  bake.put(cBodyDk, rbox(0.1, 0.12, 0.08, 0.02, 2), B.x, housingY1 - 0.06, GZ + 0.0); // destek
  const piston = new THREE.Group();
  panel.add(piston);
  piston.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.2, 10).translate(0, 0.1, 0), cSteel));
  const cross = new THREE.Mesh(rbox(0.07, 0.04, 0.05, 0.015, 2), cBrass);
  piston.add(cross);
  piston.position.set(B.x, 0.3, GZ + 0.07);
  // kılavuz rayları
  bake.put(cDark, rbox(0.014, 0.2, 0.02, 0.006, 1), B.x - 0.05, 0.33, GZ + 0.04);
  bake.put(cDark, rbox(0.014, 0.2, 0.02, 0.006, 1), B.x + 0.05, 0.33, GZ + 0.04);

  // Basınç göstergesi
  const GX = -0.03;
  const GY = 0.45;
  bake.put(cBrass, new THREE.CylinderGeometry(0.13, 0.135, 0.05, 32), GX, GY, GZ + 0.02, Math.PI / 2);
  bake.put(cCopper, new THREE.TorusGeometry(0.125, 0.018, 8, 32), GX, GY, GZ + 0.05);
  bake.put(cCopper, new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), GX + 0.0, GY - 0.17, GZ + 0.02); // boru bağlantısı
  const gaugeTex = canvasTexture(256, 256, (x, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    x.fillStyle = PAL.cream;
    x.beginPath();
    x.arc(cx, cy, 124, 0, Math.PI * 2);
    x.fill();
    const ang = (v: number) => -Math.PI / 2 + (-135 + v * 270) * (Math.PI / 180);
    x.lineCap = 'round';
    x.strokeStyle = PAL.coral;
    x.lineWidth = 18;
    x.beginPath();
    x.arc(cx, cy, 92, ang(0.75), ang(1));
    x.stroke();
    x.strokeStyle = PAL.mint;
    x.beginPath();
    x.arc(cx, cy, 92, ang(0.15), ang(0.5));
    x.stroke();
    x.strokeStyle = PAL.ink;
    for (let i = 0; i <= 10; i++) {
      const a = ang(i / 10);
      x.lineWidth = i % 5 === 0 ? 8 : 4;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 100, cy + Math.sin(a) * 100);
      x.lineTo(cx + Math.cos(a) * (i % 5 === 0 ? 70 : 82), cy + Math.sin(a) * (i % 5 === 0 ? 70 : 82));
      x.stroke();
    }
    x.fillStyle = PAL.ink;
    x.font = 'bold 34px system-ui, sans-serif';
    x.textAlign = 'center';
    x.fillText('PSI', cx, cy + 66);
  });
  const gaugeFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.11, 32),
    new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.6 }),
  );
  gaugeFace.position.set(GX, GY, GZ + 0.047);
  panel.add(gaugeFace);
  const needle = new THREE.Group();
  needle.position.set(GX, GY, GZ + 0.055);
  panel.add(needle);
  needle.add(new THREE.Mesh(rbox(0.016, 0.1, 0.008, 0.004, 1).translate(0, 0.04, 0), clay(PAL.coral)));
  needle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 12).rotateX(Math.PI / 2), cDark));

  // Kazan: çerçeve + menteşeli kapak (poke'ta açılır, içindeki ateş görünür)
  bake.put(cDark, rbox(0.38, 0.24, 0.03, 0.04, 2), 0, -0.5, GZ + 0.0);
  bake.put(cCopper, rbox(0.42, 0.03, 0.04, 0.012, 1), 0, -0.37, GZ + 0.02);
  bake.put(cBrass, new THREE.CylinderGeometry(0.016, 0.016, 0.2, 8), -0.175, -0.5, GZ + 0.035);
  const fireBackMat = glow('#FF5A1E', 0.95, false);
  const fireBack = new THREE.Mesh(rbox(0.3, 0.17, 0.005, 0.03, 1), fireBackMat);
  fireBack.position.set(0, -0.5, GZ + 0.018);
  panel.add(fireBack);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.17, -0.5, GZ + 0.035);
  panel.add(doorPivot);
  const doorParts = [
    flat(rbox(0.33, 0.2, 0.035, 0.035, 2).translate(0.17, 0, 0)),
    flat(new THREE.CylinderGeometry(0.016, 0.016, 0.09, 8).translate(0.29, 0, 0.035)),
  ];
  for (const hy of [-0.07, 0.07])
    doorParts.push(flat(new THREE.IcosahedronGeometry(0.016, 0).translate(0.03, hy, 0.02)));
  const door = new THREE.Mesh(
    mergeGeometries(
      doorParts.map((g) => {
        g.deleteAttribute('uv');
        return g;
      }),
      false,
    )!,
    cSlate,
  );
  doorPivot.add(door);
  const fireMat = glow('#FF9A3C', 0.9);
  const fireGeo = mergeGeometries(
    [-0.05, 0, 0.05].map((y) => flat(rbox(0.2, 0.022, 0.01, 0.008, 1).translate(0.15, y, 0))),
    false,
  )!;
  const fire = new THREE.Mesh(fireGeo, fireMat);
  fire.position.z = 0.016;
  doorPivot.add(fire);

  // Pirinç isim plakası
  const plateTex = canvasTexture(256, 96, (x, w, h) => {
    x.fillStyle = '#E9B65A';
    x.beginPath();
    x.roundRect(4, 4, w - 8, h - 8, 20);
    x.fill();
    x.strokeStyle = '#B9822F';
    x.lineWidth = 6;
    x.stroke();
    x.fillStyle = PAL.ink;
    x.font = 'bold 44px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('API·v2', w / 2, h / 2 + 2);
  });
  const namePlate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.09),
    new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.6 }),
  );
  namePlate.position.set(0.37, -0.36, GZ + 0.004);
  namePlate.rotation.z = 0.5;
  panel.add(namePlate);
  // sol: iki ampul
  const bulbMat = glow('#FFD27A', 0.9);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.036, 12, 8), bulbMat, 2);
  const bo = new THREE.Object3D();
  [
    [-0.5, -0.18],
    [-0.42, -0.08],
  ].forEach(([x, y], i) => {
    bo.position.set(x, y, GZ + 0.03);
    bo.updateMatrix();
    bulbs.setMatrixAt(i, bo.matrix);
    bake.put(cBrass, new THREE.CylinderGeometry(0.03, 0.034, 0.03, 12), x, y, GZ + 0.005, Math.PI / 2);
  });
  panel.add(bulbs);

  // ---------- Tepe: sunucu platformu ----------
  const TDIR = V(0, 1, 0.3);
  const TF = frame(TDIR, 0, new THREE.Vector3(0, 0, -1));
  const TP = 0.4;
  const TZ = Math.sqrt(R * R - TP * TP);
  bake.frame.copy(TF);
  bake.put(
    cSlate,
    new THREE.CylinderGeometry(TP, TP + 0.03, R + 0.03 - TZ + 0.04, 48),
    0,
    0,
    (R + 0.03 + TZ - 0.04) / 2,
    Math.PI / 2,
  );
  bake.put(cCopper, new THREE.TorusGeometry(TP + 0.005, 0.03, 8, 48), 0, 0, R + 0.02);
  const towers: [number, number, number][] = [
    [-0.22, 0.02, 0.3],
    [-0.075, 0.1, 0.4],
    [0.075, 0.1, 0.34],
    [0.22, 0.02, 0.28],
  ];
  const TW = 0.13;
  const LEDS_PER = 10;
  const ledGeo = new THREE.BoxGeometry(0.022, 0.006, 0.016);
  const ledMat = glow('#FFFFFF', 1);
  const leds = new THREE.InstancedMesh(ledGeo, ledMat, towers.length * LEDS_PER);
  const ledCols: THREE.Color[] = [];
  const ledPhase: number[] = [];
  const lo = new THREE.Object3D();
  const palLed = ['#7CF5A0', '#7CF5A0', '#FFC857', '#6FE3FF', '#7CF5A0', '#FF8A7A'];
  towers.forEach(([x, y, h], ti) => {
    const base = R + 0.03;
    bake.put(ti % 2 ? cDark : cSlate, rbox(TW, TW, h, 0.025, 2), x, y, base + h / 2);
    bake.put(cBrass, rbox(TW + 0.02, TW + 0.02, 0.025, 0.01, 1), x, y, base + h + 0.005);
    // ön yüzde yatay sürücü yuvaları
    for (let k = 0; k < 5; k++)
      bake.put(
        cDark,
        new THREE.BoxGeometry(TW * 0.8, 0.008, 0.02),
        x,
        y - TW / 2 - 0.002,
        base + 0.05 + (k * (h - 0.08)) / 5,
      );
    for (let k = 0; k < LEDS_PER; k++) {
      const col = k % 2;
      const row = Math.floor(k / 2);
      lo.position.set(x - 0.03 + col * 0.06, y - TW / 2 - 0.006, base + 0.07 + (row * (h - 0.1)) / 5);
      lo.updateMatrix();
      lo.matrix.premultiply(TF);
      leds.setMatrixAt(ti * LEDS_PER + k, lo.matrix);
      ledCols.push(new THREE.Color(palLed[(ti * 3 + k) % palLed.length]));
      ledPhase.push(Math.random() * 10);
    }
  });
  root.add(leds);
  // anten (en uzun kulede) + kablolar
  const [ax, ay, ah] = towers[1];
  bake.put(cBrass, new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), ax, ay, R + 0.03 + ah + 0.1, Math.PI / 2);
  const antTip = new THREE.Vector3(ax, ay, R + 0.03 + ah + 0.2).applyMatrix4(TF);
  const cableMat = cSage;
  for (let i = 0; i < towers.length - 1; i++) {
    const [x0, y0, h0] = towers[i];
    const [x1, y1, h1] = towers[i + 1];
    const zt = R + 0.03;
    const pts = [
      new THREE.Vector3(x0, y0 - 0.05, zt + h0 * 0.7),
      new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2 - 0.1, zt + 0.08),
      new THREE.Vector3(x1, y1 - 0.05, zt + h1 * 0.7),
    ];
    bake.put(i % 2 ? cRed : cableMat, tube(pts, 0.012, 16, 6), 0, 0, 0);
  }
  // ön kenardan platforma inen kalın kablo
  bake.put(
    cBlue,
    tube(
      [
        new THREE.Vector3(0.28, -0.12, R + 0.12),
        new THREE.Vector3(0.4, -0.3, R + 0.06),
        new THREE.Vector3(0.36, -0.42, R - 0.12),
      ],
      0.02,
      20,
      8,
    ),
    0,
    0,
    0,
  );
  const antMat = glow('#FF6B6B', 1);
  const ant = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), antMat);
  ant.position.copy(antTip);
  root.add(ant);

  // ---------- Bacalar ----------
  type Emitter = { tip: THREE.Vector3; dir: THREE.Vector3; rate: number; off: number };
  const emitters: Emitter[] = [];
  const chim = (dir: THREE.Vector3, len: number, rad: number, band: THREE.Material) => {
    const f = frame(dir, 0);
    bake.frame.copy(f);
    bake.put(cCopper, new THREE.CylinderGeometry(rad, rad * 1.1, len, 18), 0, 0, R - 0.04 + len / 2, Math.PI / 2);
    bake.put(cBodyDk, new THREE.CylinderGeometry(rad * 1.7, rad * 1.9, 0.06, 18), 0, 0, R - 0.01, Math.PI / 2);
    bake.put(band, new THREE.CylinderGeometry(rad * 1.06, rad * 1.06, 0.05, 18), 0, 0, R + len * 0.45, Math.PI / 2);
    bake.put(cDark, new THREE.CylinderGeometry(rad * 1.35, rad * 1.15, 0.06, 18), 0, 0, R - 0.04 + len, Math.PI / 2);
    bake.put(cDark, new THREE.TorusGeometry(rad * 1.2, 0.02, 8, 18), 0, 0, R - 0.01 + len);
    emitters.push({
      tip: dir.clone().multiplyScalar(R - 0.02 + len),
      dir: dir.clone(),
      rate: 0.5 + emitters.length * 0.12,
      off: emitters.length * 0.31,
    });
  };
  chim(V(-0.62, 0.66, 0.3), 0.36, 0.07, cRed);
  chim(V(0.66, 0.6, 0.12), 0.3, 0.06, cSage);
  chim(V(-0.2, 0.55, -0.82), 0.4, 0.075, cBrass);

  // Düdük (sol üst boru ucunda)
  const WD = V(-0.42, 0.82, 0.38);
  bake.frame.copy(frame(WD, 0));
  bake.put(cBrass, new THREE.CylinderGeometry(0.025, 0.025, 0.2, 12), 0, 0, R + 0.08, Math.PI / 2);
  bake.put(cBrass, new THREE.CylinderGeometry(0.03, 0.05, 0.1, 14), 0, 0, R + 0.22, Math.PI / 2);
  bake.put(cDark, new THREE.TorusGeometry(0.03, 0.01, 6, 14), 0, 0, R + 0.272);
  bake.put(cCopper, new THREE.CylinderGeometry(0.055, 0.06, 0.04, 14), 0, 0, R, Math.PI / 2);
  const whistleTip = WD.clone().multiplyScalar(R + 0.28);

  // ---------- Borular (yüzeyi saran) ----------
  bake.frame.identity();
  const arc = (ds: THREE.Vector3[], r: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < ds.length - 1; i++) {
      for (let k = 0; k < 8; k++) {
        const u = k / 8;
        pts.push(
          new THREE.Vector3()
            .copy(ds[i])
            .lerp(ds[i + 1], u)
            .normalize()
            .multiplyScalar(r),
        );
      }
    }
    pts.push(ds[ds.length - 1].clone().normalize().multiplyScalar(r));
    return pts;
  };
  const flange = new THREE.TorusGeometry(0.05, 0.016, 6, 12);
  const pipe = (ds: THREE.Vector3[], mat: THREE.Material, rad: number) => {
    const pts = arc(ds, R + rad * 0.6);
    const curve = new THREE.CatmullRomCurve3(pts);
    bake.put(mat, new THREE.TubeGeometry(curve, 40, rad, 8), 0, 0, 0);
    const q = new THREE.Quaternion();
    for (const u of [0.04, 0.5, 0.96]) {
      const p = curve.getPointAt(u);
      const tg = curve.getTangentAt(u);
      q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg);
      const m = new THREE.Matrix4().compose(p, q, new THREE.Vector3(rad / 0.035, rad / 0.035, 1));
      bake.putM(cBrass, flange, m);
    }
    return curve;
  };
  pipe([V(0.7, -0.15, 0.7), V(0.85, 0.2, 0.45), V(0.66, 0.6, 0.12)], cCopper, 0.035);
  pipe([V(-0.68, -0.3, 0.66), V(-0.95, 0.0, 0.2), V(-0.62, 0.66, 0.3)], cBrass, 0.035);
  const backPipe = pipe(
    [V(0.92, -0.3, -0.2), V(0.3, -0.3, -0.92), V(-0.6, -0.3, -0.75), V(-0.95, -0.3, -0.05)],
    cSage,
    0.04,
  );
  pipe([V(0, 0.82, -0.5), V(0.05, 0.4, -0.9), V(0.25, -0.05, -0.97)], cRed, 0.03);
  pipe([V(0.35, -0.85, 0.4), V(0, -0.98, 0.1), V(-0.45, -0.85, 0.3)], cCopper, 0.035);
  pipe([V(-0.35, 0.82, 0.46), V(-0.55, 0.75, 0.38)], cCopper, 0.025); // düdüğe besleme

  // Vana çarkları (döner)
  const valveGeo = mergeGeometries(
    [
      new THREE.TorusGeometry(0.07, 0.016, 8, 20),
      new THREE.BoxGeometry(0.14, 0.018, 0.018),
      new THREE.BoxGeometry(0.018, 0.14, 0.018),
      new THREE.CylinderGeometry(0.022, 0.022, 0.03, 10).rotateX(Math.PI / 2),
    ].map((g) => (g.index ? g.toNonIndexed() : g)),
    false,
  )!;
  const valves: THREE.Mesh[] = [];
  const valveAt = (d: THREE.Vector3, mat: THREE.Material) => {
    const f = frame(d, 0);
    bake.frame.copy(f);
    bake.put(cDark, new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8), 0, 0, R + 0.06, Math.PI / 2);
    bake.frame.identity();
    const v = new THREE.Mesh(valveGeo, mat);
    v.applyMatrix4(f);
    v.position.copy(d).multiplyScalar(R + 0.13);
    root.add(v);
    valves.push(v);
  };
  valveAt(backPipe.getPointAt(0.33).clone().normalize(), cRed);
  valveAt(V(0.86, 0.18, 0.47), cSage);
  valveAt(V(0.05, -0.97, 0.15), cRed);

  // ---------- Pencereler (sıcak ışıklı lomboz) ----------
  const winDirs = [
    V(-0.9, -0.42, 0.1),
    V(0.82, -0.52, 0.12),
    V(0.5, -0.45, -0.74),
    V(-0.42, 0.2, -0.88),
    V(-0.75, 0.3, -0.55),
    V(0.5, 0.35, -0.8),
  ];
  const winGlowMat = glow('#FFB13B', 1, false);
  const winGlow = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 20), winGlowMat, winDirs.length + 1);
  const haloMat = glow('#FFB13B', 0.35);
  const halo = new THREE.InstancedMesh(new THREE.RingGeometry(0.13, 0.2, 24), haloMat, winDirs.length);
  const wo = new THREE.Object3D();
  winDirs.forEach((d, i) => {
    const f = frame(d, 0);
    bake.frame.copy(f);
    bake.put(i % 2 ? cCopper : cBrass, new THREE.TorusGeometry(0.11, 0.026, 6, 20), 0, 0, R + 0.005);
    bake.put(cDark, new THREE.BoxGeometry(0.2, 0.014, 0.012), 0, 0, R + 0.012);
    bake.put(cDark, new THREE.BoxGeometry(0.014, 0.2, 0.012), 0, 0, R + 0.012);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3;
      bake.put(cBrass, rivetG, Math.cos(a) * 0.16, Math.sin(a) * 0.16, R, 0, 0, 0, 0.8);
    }
    wo.matrix.copy(f).multiply(new THREE.Matrix4().makeTranslation(0, 0, R + 0.004));
    winGlow.setMatrixAt(i, wo.matrix);
    wo.matrix.copy(f).multiply(new THREE.Matrix4().makeTranslation(0, 0, R + 0.03));
    halo.setMatrixAt(i, wo.matrix);
  });
  // Kemerli kapı (sol)
  const DD = V(-0.86, -0.05, 0.5);
  const DF = frame(DD, 0);
  bake.frame.copy(DF);
  bake.put(cSage, rbox(0.2, 0.2, 0.06, 0.03, 2), 0, -0.04, R - 0.01);
  bake.put(
    cSage,
    new THREE.CylinderGeometry(0.1, 0.1, 0.06, 20, 1, false, -Math.PI / 2, Math.PI),
    0,
    0.06,
    R - 0.01,
    Math.PI / 2,
  );
  bake.put(cBrass, new THREE.SphereGeometry(0.016, 8, 6), 0.06, -0.06, R + 0.025);
  bake.put(cCopper, new THREE.TorusGeometry(0.045, 0.012, 6, 16), 0, 0.05, R + 0.025);
  wo.matrix
    .copy(DF)
    .multiply(
      new THREE.Matrix4().compose(
        new THREE.Vector3(0, 0.05, R + 0.024),
        new THREE.Quaternion(),
        new THREE.Vector3(0.55, 0.55, 1),
      ),
    );
  winGlow.setMatrixAt(winDirs.length, wo.matrix);
  root.add(winGlow, halo);

  // Renkli kil yamalar (kapaklar)
  const patches: [THREE.Vector3, THREE.Material, number][] = [
    [V(0.55, -0.78, -0.3), cBlue, 0.16],
    [V(-0.3, -0.85, -0.45), cSage, 0.14],
    [V(0.92, 0.25, -0.25), cRed, 0.12],
    [V(-0.25, 0.35, -0.92), cBlue, 0.1],
  ];
  for (const [d, m, s] of patches) {
    bake.frame.copy(frame(d, 0));
    bake.put(m, new THREE.SphereGeometry(1, 20, 10), 0, 0, R - 0.01, 0, 0, 0, [s, s * 0.8, 0.04]);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.8;
      bake.put(cBrass, rivetG, Math.cos(a) * s * 0.7, Math.sin(a) * s * 0.55, R + 0.025, 0, 0, 0, 0.7);
    }
  }
  bake.build(root);

  // ---------- Buhar ----------
  const PER = 6;
  const WH = 9;
  const NP = emitters.length * PER + WH;
  const puffGeo = mergeGeometries(
    [
      flat(new THREE.IcosahedronGeometry(1, 1)),
      flat(new THREE.IcosahedronGeometry(0.7, 0).translate(0.75, 0.25, 0)),
      flat(new THREE.IcosahedronGeometry(0.65, 0).translate(-0.7, 0.15, 0.1)),
    ],
    false,
  )!;
  const puffs = new THREE.InstancedMesh(puffGeo, cSteam, NP);
  puffs.frustumCulled = false;
  root.add(puffs);
  const po = new THREE.Object3D();
  const wind = new THREE.Vector3(0.35, 0.15, -0.1);
  const ledC = new THREE.Color();
  const whU: number[] = new Array(WH).fill(-1);

  // ---------- Durum ----------
  const shot = new OneShot(2.8);
  let angA = 0;
  let angE = 0;
  let speed = 0.55;
  let steamT = 0;
  let needleV = 0.35;
  let ledT = 0;
  const pistonY = (phi: number) => B.y + RP * Math.sin(phi) + Math.sqrt(LROD * LROD - Math.pow(RP * Math.cos(phi), 2));

  return {
    group,
    poke() {
      shot.start();
      for (let i = 0; i < WH; i++) whU[i] = -i * 0.07;
    },
    update(s) {
      const dt = s.dt;
      const t = s.t;
      const hv = s.hover;
      const rm = s.reduce ? 0.2 : 1;
      const p = shot.tick(dt);
      const poking = p >= 0;
      const boost = poking ? smooth(0.0, 0.12, p) * (1 - smooth(0.35, 1, p)) : 0;

      // ---- dişliler ----
      const sTarget = (0.55 + hv * 0.9 + boost * 5) * rm;
      speed = damp(speed, sTarget, poking ? 6 : 2, dt);
      angA += speed * dt;
      A.mesh.rotation.z = angA;
      const rot = (g: Gear, th: number) => th + Math.PI + Math.PI / g.N - (angA - th) * (A.N / g.N);
      const angB = rot(B, tB);
      B.mesh.rotation.z = angB;
      C.mesh.rotation.z = rot(C, tC);
      angE -= speed * 1.3 * dt;
      E.mesh.rotation.z = angE;
      F.mesh.rotation.z = Math.PI + Math.PI / F.N - angE * (E.N / F.N);

      // ---- krank / biyel / piston ----
      const phi = angB;
      const px = B.x + RP * Math.cos(phi);
      const py = B.y + RP * Math.sin(phi);
      const cy = pistonY(phi);
      piston.position.y = cy;
      rod.position.set((px + B.x) / 2, (py + cy) / 2, GZ + 0.11);
      rod.scale.set(1, LROD, 1);
      rod.rotation.z = Math.atan2(cy - py, B.x - px) - Math.PI / 2;

      // ---- basınç göstergesi ----
      const nTarget =
        0.38 +
        Math.sin(t * 0.9) * 0.06 +
        Math.sin(t * 7.3) * 0.012 +
        hv * 0.15 +
        (poking ? (p < 0.12 ? smooth(0, 0.12, p) * 0.62 : 0.62 * (1 - smooth(0.2, 0.9, p))) : 0);
      needleV = damp(needleV, Math.min(1.02, nTarget), poking ? 14 : 4, dt);
      const jitter = poking && p < 0.35 ? Math.sin(t * 60) * 0.02 : 0;
      needle.rotation.z = 2.356 - (needleV + jitter) * 4.712;

      // ---- ateş, pencereler, ampuller ----
      const flick = 0.75 + 0.15 * Math.sin(t * 13) + 0.1 * Math.sin(t * 23.7);
      fireMat.opacity = Math.min(1, flick * (0.75 + s.night * 0.25) + boost * 0.4);
      fireMat.color.setRGB(1, 0.55 + boost * 0.3, 0.2 + boost * 0.3);
      fireBackMat.color.setRGB(1, 0.28 + 0.08 * Math.sin(t * 17) + boost * 0.12, 0.06);
      const doorOpen = poking ? ease.outBack(smooth(0.05, 0.2, p)) * (1 - smooth(0.7, 0.95, p)) : 0;
      doorPivot.rotation.y = -1.6 * doorOpen;
      winGlowMat.opacity = 0.8 + s.night * 0.2 - (Math.sin(t * 0.7) > 0.97 ? 0.3 : 0);
      haloMat.opacity = (0.12 + s.night * 0.3) * (0.85 + 0.15 * Math.sin(t * 1.7)) + boost * 0.2;
      bulbMat.opacity = 0.6 + 0.3 * Math.sin(t * 2.4) + s.night * 0.1 + boost * 0.3;
      antMat.opacity = Math.sin(t * 4) > 0.2 ? 1 : 0.2;

      // ---- sunucu LED'leri ----
      ledT += dt * (1 + hv * 2.5 + boost * 6);
      for (let i = 0; i < ledCols.length; i++) {
        const v = Math.sin(ledT * (2 + (i % 5)) + ledPhase[i]);
        const on = poking && p < 0.5 ? (Math.floor(t * 12) % 2 === 0 ? 1 : 0.5) : v > -0.2 ? 1 : 0.12;
        ledC.copy(ledCols[i]).multiplyScalar(on * (0.75 + s.night * 0.25));
        leds.setColorAt(i, ledC);
      }
      if (leds.instanceColor) leds.instanceColor.needsUpdate = true;

      // ---- vanalar ----
      for (let i = 0; i < valves.length; i++) valves[i].rotateZ(dt * (0.3 + boost * 6) * (i % 2 ? -1 : 1) * rm);

      // ---- buhar ----
      steamT += dt * (1 + hv * 0.8 + boost * 2.5) * (s.reduce ? 0.3 : 1);
      let n = 0;
      for (const em of emitters) {
        for (let k = 0; k < PER; k++) {
          const u = (steamT * em.rate * 0.5 + k / PER + em.off) % 1;
          const size = (0.05 + u * 0.09) * Math.pow(Math.sin(Math.min(1, u * 1.25) * Math.PI), 0.6) * (1 + boost * 0.6);
          po.position
            .copy(em.tip)
            .addScaledVector(em.dir, 0.04 + u * 0.42)
            .addScaledVector(wind, u * u * 0.35);
          po.position.x += Math.sin(u * 9 + k) * 0.03;
          po.rotation.set(k, u * 2 + k, u * 1.5);
          po.scale.setScalar(Math.max(0.0001, size));
          po.updateMatrix();
          puffs.setMatrixAt(n++, po.matrix);
        }
      }
      // düdük jeti
      for (let k = 0; k < WH; k++) {
        if (whU[k] < 1 && (whU[k] > -1 || poking)) whU[k] += dt * 1.4;
        const u = whU[k];
        if (u >= 0 && u < 1 && poking) {
          po.position
            .copy(whistleTip)
            .addScaledVector(WD, 0.03 + u * 0.5)
            .addScaledVector(wind, u * u * 0.2);
          po.rotation.set(k, u * 4, 0);
          po.scale.setScalar(Math.max(0.0001, (0.05 + u * 0.15) * Math.sin(Math.min(1, u * 1.1) * Math.PI)));
        } else po.scale.setScalar(0.0001);
        if (u >= 1 && poking && p < 0.55) whU[k] = 0;
        po.updateMatrix();
        puffs.setMatrixAt(n++, po.matrix);
      }
      puffs.instanceMatrix.needsUpdate = true;

      // ---- gövde ----
      const shake = poking && p < 0.4 ? Math.sin(t * 50) * 0.012 * (1 - p / 0.4) : 0;
      const hop = poking ? ease.out(Math.sin(Math.min(1, p / 0.5) * Math.PI)) * 0.06 : 0;
      root.position.set(shake, Math.sin(t * 0.9) * 0.025 * rm + hop, 0);
      root.rotation.y = Math.sin(t * 0.3) * 0.18 * rm;
      root.rotation.x = Math.sin(t * 0.55) * 0.03 * rm;
      const sq = poking ? Math.sin(Math.min(1, p / 0.25) * Math.PI) * 0.04 : 0;
      root.scale.set(1 + sq, 1 - sq, 1 + sq);
    },
  };
}
