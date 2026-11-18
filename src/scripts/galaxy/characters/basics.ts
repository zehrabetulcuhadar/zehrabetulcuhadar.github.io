import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clay, glow, rbox, canvasTexture, damp, smooth, ease, OneShot, PAL, type Character } from './kit';

/**
 * Basics: tombul kil dizüstü bilgisayar gezegeni.
 * Kapak arka menteşeden açılıp kapanır, ekranda boot yazısı / ikili akış / imleç,
 * tuşlar kendi kendine basılır, çevresinde 0 ve 1'lerden bir halka döner,
 * kapağın sırtında devre yolları parlayan bir CPU yongası var.
 */

type Part = { g: THREE.BufferGeometry; m: THREE.Matrix4 };

/** Aynı malzemeli statik parçaları tek çizim çağrısında birleştirir. */
class Baker {
  bins = new Map<THREE.Material, Part[]>();
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
    let arr = this.bins.get(mat);
    if (!arr) this.bins.set(mat, (arr = []));
    arr.push({ g, m: o.matrix.clone() });
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

/** Dik köşeli devre yolu (Manhattan). */
function trace(pts: [number, number][], z: number) {
  const c = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < pts.length - 1; i++)
    c.add(
      new THREE.LineCurve3(
        new THREE.Vector3(pts[i][0], pts[i][1], z),
        new THREE.Vector3(pts[i + 1][0], pts[i + 1][1], z),
      ),
    );
  return c;
}

const SCRIPT = [
  '> 1 + 1 = 10',
  '> add r1, r2',
  '> RAM[0x2A] = 42',
  '> 01001000 01101001',
  '> print("hi")',
  '> 0b1111 = 15',
];

export default function create(): Character {
  const group = new THREE.Group();
  const root = new THREE.Group();
  group.add(root);
  root.position.y = -0.08;
  root.scale.setScalar(1.08);

  // ---------- Renkler ----------
  const cShell = clay('#A9B4F7');
  const cShellDk = clay('#8A93E6');
  const cWell = clay('#6E68B8');
  const cKey = clay(PAL.cream);
  const cBezel = clay('#4A3657');
  const cSteel = clay(PAL.steel);
  const cGold = clay('#E9B65A');
  const cRubber = clay('#5B4A6B');
  const cMint = clay(PAL.mint);
  const cPink = clay(PAL.pink);
  const cButter = clay(PAL.butter);
  const cCoral = clay(PAL.coral);
  const cRam = clay('#6FBF8E');
  const cChipDark = clay('#3F3550');

  // ---------- Gövde (alt kasa) ----------
  const W = 1.9;
  const D = 1.3;
  const H = 0.2;
  const deckY = -0.42;
  const top = deckY + H / 2;
  const deck = new Baker();
  deck.put(cShell, rbox(W, H, D, 0.09, 4), 0, deckY, 0);
  deck.put(cShellDk, rbox(W + 0.02, 0.06, D + 0.02, 0.03, 3), 0, deckY - 0.08, 0); // alt kabuk şeridi
  // klavye yuvası
  deck.put(cWell, rbox(1.66, 0.04, 0.72, 0.03, 2), 0, top - 0.005, -0.17);
  // touchpad ve tuşları
  deck.put(cShellDk, rbox(0.58, 0.02, 0.3, 0.04, 2), 0, top + 0.002, 0.39);
  deck.put(cShellDk, rbox(0.28, 0.018, 0.06, 0.02, 2), -0.145, top + 0.002, 0.57);
  deck.put(cShellDk, rbox(0.28, 0.018, 0.06, 0.02, 2), 0.145, top + 0.002, 0.57);
  // lastik ayaklar
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      deck.put(cRubber, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 14), sx * 0.75, deckY - 0.12, sz * 0.5);
  // yan portlar (sağ): USB, USB, ses jakı; sol: havalandırma
  const usb = rbox(0.02, 0.04, 0.11, 0.008, 1);
  deck.put(cChipDark, usb, W / 2 + 0.002, deckY + 0.01, -0.25);
  deck.put(cChipDark, usb, W / 2 + 0.002, deckY + 0.01, -0.05);
  deck.put(
    cChipDark,
    new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12),
    W / 2 + 0.002,
    deckY + 0.01,
    0.15,
    0,
    0,
    Math.PI / 2,
  );
  for (let i = 0; i < 6; i++)
    deck.put(cWell, rbox(0.02, 0.03, 0.09, 0.01, 1), -W / 2 - 0.002, deckY + 0.015, -0.35 + i * 0.12);
  // menteşe silindirleri
  const pivotY = top + 0.05;
  const pivotZ = -D / 2 + 0.07;
  for (const sx of [-0.62, 0.62]) {
    deck.put(cShellDk, new THREE.CylinderGeometry(0.06, 0.06, 0.34, 18), sx, pivotY - 0.01, pivotZ, 0, 0, Math.PI / 2);
    deck.put(
      cSteel,
      new THREE.CylinderGeometry(0.064, 0.064, 0.03, 18),
      sx - 0.17,
      pivotY - 0.01,
      pivotZ,
      0,
      0,
      Math.PI / 2,
    );
    deck.put(
      cSteel,
      new THREE.CylinderGeometry(0.064, 0.064, 0.03, 18),
      sx + 0.17,
      pivotY - 0.01,
      pivotZ,
      0,
      0,
      Math.PI / 2,
    );
  }
  // ön kenardaki küçük çentik (açma yuvası)
  deck.put(cShellDk, rbox(0.3, 0.035, 0.04, 0.015, 2), 0, top - 0.015, D / 2 - 0.005);
  deck.build(root);

  // Avuç içi çıkartmaları (kalp ve "01")
  const stickerTex = canvasTexture(256, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = PAL.coral;
    x.beginPath();
    const hx = 64,
      hy = 64;
    x.moveTo(hx, hy + 34);
    x.bezierCurveTo(hx - 60, hy - 4, hx - 26, hy - 50, hx, hy - 20);
    x.bezierCurveTo(hx + 26, hy - 50, hx + 60, hy - 4, hx, hy + 34);
    x.fill();
    x.strokeStyle = '#fff';
    x.lineWidth = 6;
    x.stroke();
    x.fillStyle = PAL.butter;
    x.beginPath();
    x.arc(192, 64, 52, 0, Math.PI * 2);
    x.fill();
    x.stroke();
    x.fillStyle = PAL.ink;
    x.font = 'bold 50px ui-monospace, Menlo, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('01', 192, 68);
  });
  const stickerMat = new THREE.MeshStandardMaterial({
    map: stickerTex,
    transparent: true,
    roughness: 0.7,
    alphaTest: 0.05,
  });
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17), stickerMat);
  sticker.rotation.x = -Math.PI / 2;
  sticker.rotation.z = 0.12;
  sticker.position.set(0.6, top + 0.003, 0.4);
  root.add(sticker);
  const badgeTex = canvasTexture(128, 128, (x, w, h) => {
    x.fillStyle = PAL.paper;
    x.beginPath();
    x.roundRect(6, 6, w - 12, h - 12, 18);
    x.fill();
    x.fillStyle = PAL.periwinkle;
    x.beginPath();
    x.roundRect(18, 18, w - 36, h - 36, 10);
    x.fill();
    x.fillStyle = '#fff';
    x.font = 'bold 34px ui-monospace, Menlo, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('8-BIT', w / 2, h / 2 - 12);
    x.font = 'bold 18px ui-monospace, Menlo, monospace';
    x.fillText('inside', w / 2, h / 2 + 20);
  });
  const badge = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.16),
    new THREE.MeshStandardMaterial({ map: badgeTex, roughness: 0.7 }),
  );
  badge.rotation.x = -Math.PI / 2;
  badge.rotation.z = -0.08;
  badge.position.set(-0.62, top + 0.003, 0.42);
  root.add(badge);

  // Güç ışığı + caps ışığı
  const ledMat = glow('#7CF5C8', 0.95, false);
  const ledGeo = new THREE.SphereGeometry(0.022, 10, 8);
  const powerLed = new THREE.Mesh(ledGeo, ledMat);
  powerLed.scale.set(1.4, 0.7, 0.6);
  powerLed.position.set(-0.7, deckY + 0.01, D / 2 + 0.002);
  root.add(powerLed);
  const capsLed = new THREE.Mesh(ledGeo, ledMat);
  capsLed.scale.set(0.8, 0.5, 0.8);
  capsLed.position.set(0.78, top + 0.004, -0.6);
  root.add(capsLed);

  // ---------- Klavye (instanced) ----------
  const COLS = 12;
  const ROWS = 4;
  const kp = 0.13;
  const keyGeo = rbox(0.112, 0.05, 0.108, 0.022, 1);
  type K = { x: number; z: number; sx: number; press: number };
  const keys: K[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      keys.push({ x: (c - (COLS - 1) / 2) * kp + (r % 2) * 0.03 - 0.015, z: -0.45 + r * kp, sx: 1, press: 0 });
  const bz = -0.45 + ROWS * kp;
  for (const x of [-0.72, -0.59, -0.46]) keys.push({ x, z: bz, sx: 1, press: 0 });
  const SPACE = keys.length;
  keys.push({ x: 0, z: bz, sx: 5.6, press: 0 });
  for (const x of [0.46, 0.59, 0.72]) keys.push({ x, z: bz, sx: 1, press: 0 });
  const keyMesh = new THREE.InstancedMesh(keyGeo, cKey, keys.length);
  const tc = new THREE.Color();
  keys.forEach((k, i) => {
    let col: string = i % 6 === 5 ? '#FFE7C2' : PAL.cream;
    if (i === 0) col = PAL.coral;
    else if (i === COLS - 1 || i === 2 * COLS - 1) col = PAL.mint;
    else if (i === 2 * COLS) col = PAL.butter;
    else if (i === 3 * COLS || i === 4 * COLS - 1) col = PAL.pink;
    else if (k.sx > 2) col = PAL.lilac;
    else if (i >= ROWS * COLS) col = '#FFE7C2';
    keyMesh.setColorAt(i, tc.set(col));
  });
  root.add(keyMesh);
  const kObj = new THREE.Object3D();
  const keyBaseY = top + 0.012;
  function placeKeys() {
    keys.forEach((k, i) => {
      kObj.position.set(k.x, keyBaseY - k.press * 0.028, k.z);
      kObj.scale.set(k.sx, 1, 1);
      kObj.updateMatrix();
      keyMesh.setMatrixAt(i, kObj.matrix);
    });
    keyMesh.instanceMatrix.needsUpdate = true;
  }
  placeKeys();
  const sparkMat = glow('#FFE38A', 0);
  const spark = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), sparkMat);
  spark.rotation.x = -Math.PI / 2;
  root.add(spark);

  // ---------- Kapak ----------
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, pivotY, pivotZ);
  root.add(lidPivot);
  const LW = 1.84;
  const LL = 1.2;
  const LT = 0.075;
  const lid = new Baker();
  lid.put(cShell, rbox(LW, LL, LT, 0.07, 4), 0, LL / 2 + 0.02, -0.006 - LT / 2);
  lid.put(cBezel, rbox(LW - 0.08, LL - 0.08, 0.02, 0.05, 3), 0, LL / 2 + 0.02, -0.006);
  lid.put(cChipDark, new THREE.CylinderGeometry(0.022, 0.022, 0.01, 14), 0, LL - 0.015, 0.006, Math.PI / 2);
  lid.put(cSteel, new THREE.TorusGeometry(0.026, 0.006, 6, 16), 0, LL - 0.015, 0.006);
  lid.put(cShellDk, rbox(0.22, 0.03, 0.01, 0.012, 1), 0, 0.075, 0.005);

  // Kapak sırtı: CPU, RAM, devre yolları
  const backZ = -0.006 - LT - 0.002;
  const cpuY = LL / 2 + 0.06;
  lid.put(cGold, rbox(0.46, 0.46, 0.035, 0.03, 2), 0, cpuY, backZ - 0.012);
  lid.put(cChipDark, rbox(0.36, 0.36, 0.05, 0.04, 2), 0, cpuY, backZ - 0.03);
  const pinG = new THREE.BoxGeometry(0.02, 0.06, 0.02);
  for (let i = 0; i < 6; i++) {
    const o = -0.125 + i * 0.05;
    lid.put(cSteel, pinG, o, cpuY + 0.21, backZ - 0.02);
    lid.put(cSteel, pinG, o, cpuY - 0.21, backZ - 0.02);
    lid.put(cSteel, pinG, 0.21, cpuY + o, backZ - 0.02, 0, 0, Math.PI / 2);
    lid.put(cSteel, pinG, -0.21, cpuY + o, backZ - 0.02, 0, 0, Math.PI / 2);
  }
  const ramX = 0.56;
  const ramY = LL / 2 + 0.1;
  lid.put(cRam, rbox(0.17, 0.6, 0.03, 0.02, 2), ramX, ramY, backZ - 0.014);
  for (let i = 0; i < 4; i++)
    lid.put(cChipDark, rbox(0.1, 0.09, 0.025, 0.012, 1), ramX, ramY + 0.2 - i * 0.13, backZ - 0.035);
  for (let i = 0; i < 6; i++)
    lid.put(cGold, new THREE.BoxGeometry(0.018, 0.04, 0.01), ramX - 0.065 + i * 0.026, ramY - 0.28, backZ - 0.03);
  for (const [x, y, m] of [
    [-0.5, 0.3, cMint],
    [-0.62, 0.3, cPink],
    [-0.5, 0.95, cButter],
    [0.3, 0.2, cCoral],
  ] as [number, number, THREE.Material][]) {
    lid.put(m, new THREE.CylinderGeometry(0.035, 0.035, 0.07, 14), x, y, backZ - 0.035, Math.PI / 2);
    lid.put(cSteel, new THREE.CylinderGeometry(0.036, 0.036, 0.01, 14), x, y, backZ - 0.07, Math.PI / 2);
  }
  const tz = backZ - 0.004;
  const paths = [
    trace(
      [
        [-0.12, cpuY + 0.24],
        [-0.12, cpuY + 0.4],
        [-0.45, cpuY + 0.4],
        [-0.45, LL - 0.05],
      ],
      tz,
    ),
    trace(
      [
        [0.08, cpuY + 0.24],
        [0.08, cpuY + 0.45],
        [0.35, cpuY + 0.45],
        [0.35, LL - 0.05],
      ],
      tz,
    ),
    trace(
      [
        [0.24, cpuY + 0.05],
        [0.47, cpuY + 0.05],
      ],
      tz,
    ),
    trace(
      [
        [0.24, cpuY - 0.08],
        [0.38, cpuY - 0.08],
        [0.38, 0.12],
        [0.75, 0.12],
      ],
      tz,
    ),
    trace(
      [
        [-0.24, cpuY - 0.03],
        [-0.5, cpuY - 0.03],
        [-0.5, 0.35],
      ],
      tz,
    ),
    trace(
      [
        [-0.24, cpuY + 0.1],
        [-0.75, cpuY + 0.1],
        [-0.75, 0.95],
        [-0.55, 0.95],
      ],
      tz,
    ),
    trace(
      [
        [-0.02, cpuY - 0.24],
        [-0.02, 0.15],
        [-0.6, 0.15],
        [-0.6, 0.27],
      ],
      tz,
    ),
    trace(
      [
        [0.12, cpuY - 0.24],
        [0.12, 0.08],
        [0.3, 0.08],
        [0.3, 0.16],
      ],
      tz,
    ),
  ];
  for (const p of paths) {
    lid.put(cGold, new THREE.TubeGeometry(p, 24, 0.012, 6, false), 0, 0, 0);
    const end = p.getPoint(1);
    lid.put(cGold, new THREE.CylinderGeometry(0.026, 0.026, 0.012, 12), end.x, end.y, end.z, Math.PI / 2);
  }
  lid.build(lidPivot);

  const cpuTex = canvasTexture(128, 128, (x, w, h) => {
    x.fillStyle = '#3F3550';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = PAL.butter;
    x.lineWidth = 6;
    x.strokeRect(14, 14, w - 28, h - 28);
    x.fillStyle = PAL.butter;
    x.font = 'bold 40px ui-monospace, Menlo, monospace';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('CPU', w / 2, h / 2 - 8);
    x.font = 'bold 18px ui-monospace, Menlo, monospace';
    x.fillStyle = PAL.mint;
    x.fillText('1 GHz', w / 2, h / 2 + 26);
  });
  const cpuLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.28, 0.28),
    new THREE.MeshStandardMaterial({ map: cpuTex, roughness: 0.8 }),
  );
  cpuLabel.rotation.y = Math.PI;
  cpuLabel.position.set(0, cpuY, backZ - 0.056);
  lidPivot.add(cpuLabel);

  const PULSES = paths.length * 2;
  const pulseMat = glow('#6FF3FF', 1);
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), pulseMat, PULSES);
  lidPivot.add(pulses);
  const pv = new THREE.Vector3();
  const pObj = new THREE.Object3D();
  const coreGlowMat = glow('#6FF3FF', 0.4);
  const coreGlow = new THREE.Mesh(new THREE.RingGeometry(0.19, 0.24, 32), coreGlowMat);
  coreGlow.rotation.y = Math.PI;
  coreGlow.position.set(0, cpuY, backZ - 0.058);
  lidPivot.add(coreGlow);

  // Ekran
  const SW = 512;
  const SH = 320;
  const scrTex = canvasTexture(SW, SH, () => {});
  const scrCanvas = scrTex.image as HTMLCanvasElement;
  const sx = scrCanvas.getContext('2d')!;
  const scrMat = new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.62, 1.01), scrMat);
  screen.position.set(0, LL / 2 + 0.05, 0.006);
  lidPivot.add(screen);
  const flashMat = glow('#FFFFFF', 0);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 1.05), flashMat);
  flash.position.set(0, LL / 2 + 0.05, 0.012);
  lidPivot.add(flash);

  // ---------- 0/1 halkası ----------
  const ring = new THREE.Group();
  ring.position.y = 0.05;
  ring.rotation.set(0.3, 0, 0.12);
  group.add(ring);
  const N = 44;
  const zeroGeo = new THREE.TorusGeometry(0.052, 0.02, 6, 14);
  zeroGeo.scale(0.8, 1.25, 1);
  const oneParts = [
    new THREE.BoxGeometry(0.036, 0.15, 0.036),
    new THREE.BoxGeometry(0.05, 0.03, 0.034).rotateZ(-0.6).translate(-0.025, 0.06, 0),
    new THREE.BoxGeometry(0.09, 0.03, 0.036).translate(0, -0.065, 0),
  ].map((g) => g.toNonIndexed());
  const oneGeo = mergeGeometries(oneParts, false)!;
  const bitMat = clay('#FFFFFF', { emissive: 0.25 });
  const zeros = new THREE.InstancedMesh(zeroGeo, bitMat, N);
  const ones = new THREE.InstancedMesh(oneGeo, bitMat, N);
  ring.add(zeros, ones);
  const bitPal = [PAL.sky, PAL.pink, PAL.butter, PAL.mint, PAL.lilac, PAL.apricot, PAL.coral, PAL.leaf];
  const bits: { v: number; flip: number; next: number; wob: number }[] = [];
  for (let i = 0; i < N; i++) {
    const c = tc.set(bitPal[(i * 3) % bitPal.length]);
    zeros.setColorAt(i, c);
    ones.setColorAt(i, c);
    bits.push({ v: ((i * 7) % 5) % 2, flip: 1, next: 1 + ((i * 1.37) % 4), wob: i * 1.7 });
  }
  const bObj = new THREE.Object3D();

  // ---------- Ekran çizimi ----------
  let lines: string[] = [];
  let typing = '';
  let scriptIdx = 0;
  let charIdx = 0;
  let mode: 'boot' | 'type' = 'boot';
  let bootStep = 0;
  let redrawT = 0;
  let cursorOn = true;
  let binOff = 0;
  let scrBright = 1;
  const BOOT = ['ZERO-BIOS v1.0', 'CPU ........ OK', 'RAM 640K .... OK', 'loading bits...'];
  function startBoot() {
    mode = 'boot';
    bootStep = 0;
    lines = [];
    typing = '';
  }
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';
  function draw(t: number, hello: boolean) {
    const g = sx;
    g.fillStyle = hello ? `hsl(${(t * 300) % 360},80%,86%)` : '#1E1A3A';
    g.fillRect(0, 0, SW, SH);
    if (hello) {
      g.fillStyle = PAL.ink;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold 72px ${MONO}`;
      g.fillText('Hello,', SW / 2, SH / 2 - 60);
      g.fillText('world!', SW / 2, SH / 2 + 18);
      g.font = `bold 40px ${MONO}`;
      g.fillText('^_^', SW / 2, SH / 2 + 100);
      return;
    }
    g.textAlign = 'left';
    g.textBaseline = 'top';
    // ikili yağmur sütunu (sağ kenar)
    g.font = `bold 20px ${MONO}`;
    for (let r = 0; r < 14; r++) {
      const v = Math.floor(Math.abs(Math.sin((r + Math.floor(binOff)) * 12.9898)) * 43758.5453);
      g.fillStyle = r % 3 === 0 ? 'rgba(111,243,255,0.8)' : 'rgba(183,155,245,0.6)';
      g.fillText(
        (v & 1 ? '1' : '0') + (v & 2 ? '1' : '0') + (v & 4 ? '1' : '0'),
        SW - 54,
        40 + r * 23 - (binOff % 1) * 23,
      );
    }
    // üst çubuk
    g.fillStyle = '#2E2852';
    g.fillRect(0, 0, SW, 34);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = [PAL.coral, PAL.butter, PAL.mint][i];
      g.beginPath();
      g.arc(20 + i * 22, 17, 7, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#B9B3E8';
    g.font = `bold 18px ${MONO}`;
    g.fillText('basics.sh', 92, 8);
    g.font = `bold 28px ${MONO}`;
    const all = mode === 'boot' ? BOOT.slice(0, bootStep) : lines.concat([typing]);
    const shown = all.slice(-5);
    shown.forEach((s, i) => {
      g.fillStyle =
        mode === 'boot' ? (s.endsWith('OK') ? '#8FF0B4' : '#F7C548') : s.startsWith('>') ? '#EDEAFF' : '#8FF0B4';
      g.fillText(s, 18, 46 + i * 33);
    });
    // alt panel: 8 bitlik sayaç (ikili sayma)
    const n = Math.floor(binOff * 0.5) % 256;
    g.fillStyle = '#2E2852';
    g.fillRect(0, SH - 58, SW - 64, 58);
    for (let b = 0; b < 8; b++) {
      const on = (n >> (7 - b)) & 1;
      g.fillStyle = on ? '#F7C548' : '#4A4278';
      g.fillRect(16 + b * 40, SH - 48, 32, 38);
      g.fillStyle = on ? PAL.ink : '#8C84C8';
      g.font = `bold 26px ${MONO}`;
      g.fillText(on ? '1' : '0', 24 + b * 40, SH - 43);
    }
    g.fillStyle = '#8FF0B4';
    g.fillText('= ' + n, 344, SH - 43);
    g.font = `bold 28px ${MONO}`;
    if (cursorOn) {
      const last = shown.length ? shown[shown.length - 1] : '';
      const boot = mode === 'boot';
      const cx = boot ? 18 : 18 + g.measureText(last).width + 4;
      const cy = 46 + (boot ? shown.length : Math.max(0, shown.length - 1)) * 33;
      g.fillStyle = '#6FF3FF';
      g.fillRect(cx, cy + 2, 16, 27);
    }
  }
  function drawSleep() {
    sx.fillStyle = '#120F22';
    sx.fillRect(0, 0, SW, SH);
    sx.fillStyle = 'rgba(183,155,245,0.55)';
    sx.font = `bold 44px ${MONO}`;
    sx.textAlign = 'center';
    sx.textBaseline = 'middle';
    sx.fillText('z z z', SW / 2, SH / 2);
  }
  draw(0, false);
  scrTex.needsUpdate = true;

  // ---------- Durum ----------
  const shot = new OneShot(2.8);
  let lidA = -0.28;
  let typeT = 0;
  let bootT = 0;
  let ringSpin = 0;
  let burst = 0;
  let lastPress = -1;
  let wasSleep = false;
  let pulseT = 0;

  function pressKey(i: number) {
    keys[i].press = 1;
    spark.position.set(keys[i].x, keyBaseY + 0.03, keys[i].z);
    sparkMat.opacity = 0.55;
  }
  function pressRandomKey(big = false) {
    const n = big ? keys.length : ROWS * COLS;
    let i = Math.floor(Math.random() * n);
    if (i === lastPress) i = (i + 5) % n;
    lastPress = i;
    pressKey(i);
  }

  return {
    group,
    poke() {
      shot.start();
      mode = 'boot';
      bootStep = BOOT.length;
    },
    update(s) {
      const dt = s.dt;
      const t = s.t;
      const hv = s.hover;
      const rm = s.reduce ? 0.25 : 1;
      const p = shot.tick(dt);
      const poking = p >= 0;

      // ---- kapak: hafif nefes + her 12 sn'de bir yarı kapanıp uykuya dalma ----
      const cyc = (t % 12) / 12;
      let close = s.reduce ? 0 : Math.pow(Math.sin(Math.PI * smooth(0.68, 1, cyc)), 2);
      close *= 1 - hv * 0.75;
      let target = -0.28 + Math.sin(t * 1.3) * 0.035 * rm + close * 1.38;
      if (poking) {
        const k = ease.out(Math.min(1, p / 0.1)) * (1 - smooth(0.78, 1, p));
        const q = Math.max(0, p - 0.1);
        const openA = -0.66 + Math.sin(q * 28) * Math.exp(-q * 8) * 0.14;
        target = THREE.MathUtils.lerp(target, openA, k);
        lidA = damp(lidA, target, 30, dt);
      } else lidA = damp(lidA, target, 6, dt);
      lidPivot.rotation.x = lidA;
      const sleepy = !poking && close > 0.45;

      // ---- ekran içeriği ----
      redrawT -= dt;
      typeT -= dt * (1 + hv * 1.6) * (s.reduce ? 0.4 : 1);
      cursorOn = Math.floor(t * 2.2) % 2 === 0;
      binOff += dt * (2 + hv * 4);
      if (sleepy) {
        if (!wasSleep) {
          drawSleep();
          scrTex.needsUpdate = true;
          wasSleep = true;
        }
      } else {
        if (wasSleep) {
          wasSleep = false;
          startBoot();
        }
        if (mode === 'boot' && !poking) {
          bootT -= dt;
          if (bootT <= 0) {
            bootT = 0.45;
            bootStep++;
            pressRandomKey();
            if (bootStep > BOOT.length + 1) {
              mode = 'type';
              lines = ['ready.'];
              typing = '';
            }
          }
        } else if (mode === 'type' && typeT <= 0) {
          const line = SCRIPT[scriptIdx % SCRIPT.length];
          if (charIdx < line.length) {
            const ch = line[charIdx++];
            typing += ch;
            typeT = 0.09 + Math.random() * 0.1;
            if (ch === ' ') pressKey(SPACE);
            else pressRandomKey();
          } else {
            pressKey(COLS - 1);
            lines.push(typing);
            typing = '';
            charIdx = 0;
            scriptIdx++;
            typeT = 0.7;
            if (lines.length > 12) lines.splice(0, lines.length - 12);
          }
        }
        if (redrawT <= 0) {
          redrawT = 1 / 15;
          draw(t, poking && p > 0.06 && p < 0.85);
          if (poking && p >= 0.85 && mode === 'boot') {
            mode = 'type';
            lines = ['ready.'];
            typing = '';
          }
          scrTex.needsUpdate = true;
        }
      }
      const bTarget = sleepy ? 0.35 : 0.84 + s.night * 0.16 + hv * 0.08;
      scrBright = damp(scrBright, bTarget, 5, dt);
      scrMat.color.setScalar(Math.min(1, scrBright));
      flashMat.opacity = poking ? Math.max(0, 1 - p / 0.1) * 0.85 : 0;

      // ---- tuşlar ----
      if (poking && p < 0.75 && Math.random() < dt * 30) pressRandomKey(true);
      for (const k of keys) k.press = damp(k.press, 0, 16, dt);
      placeKeys();
      sparkMat.opacity = damp(sparkMat.opacity, 0, 10, dt);
      spark.scale.setScalar(1 + (0.55 - sparkMat.opacity) * 1.5);

      // ---- LED'ler ----
      ledMat.opacity = (0.5 + 0.45 * (0.5 + 0.5 * Math.sin(t * (sleepy ? 2 : 0.9) * Math.PI))) * (0.7 + s.night * 0.3);

      // ---- devre ışıkları ----
      pulseT += dt * (0.35 + hv * 0.5 + (poking ? 1.2 : 0)) * rm;
      for (let i = 0; i < PULSES; i++) {
        const path = paths[i % paths.length];
        const u = (pulseT * (0.8 + (i % 3) * 0.2) + i * 0.37) % 1;
        path.getPointAt(u, pv);
        pObj.position.copy(pv);
        pObj.position.z -= 0.012;
        pObj.scale.setScalar(0.4 + Math.sin(u * Math.PI) * 0.8);
        pObj.updateMatrix();
        pulses.setMatrixAt(i, pObj.matrix);
      }
      pulses.instanceMatrix.needsUpdate = true;
      pulseMat.opacity = 0.7 + s.night * 0.3;
      coreGlowMat.opacity = (0.25 + 0.25 * Math.sin(t * 3)) * (0.7 + s.night * 0.6) + (poking ? 0.4 : 0);

      // ---- 0/1 halkası ----
      ringSpin += dt * (0.22 + hv * 0.35 + (poking ? 1.4 * (1 - p) : 0)) * rm;
      burst = poking && p < 0.7 ? Math.sin((p / 0.7) * Math.PI) : damp(burst, 0, 4, dt);
      for (let i = 0; i < N; i++) {
        const b = bits[i];
        b.next -= dt * (1 + hv * 2 + (poking ? 6 : 0)) * rm;
        if (b.next <= 0) {
          b.next = 1.5 + Math.random() * 3.5;
          b.v = 1 - b.v;
          b.flip = 0;
        }
        b.flip = Math.min(1, b.flip + dt * 4);
        const a = (i / N) * Math.PI * 2 + ringSpin;
        const rr = 1.58 + burst * 0.26 * (0.6 + 0.4 * Math.sin(i * 2.3)) + Math.sin(t * 2 + b.wob) * 0.02;
        const y = Math.sin(a * 3 + t * 1.5) * 0.05 * rm + burst * Math.sin(i * 5.1) * 0.25;
        bObj.position.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
        bObj.rotation.set(0, -a + Math.PI / 2, 0);
        bObj.rotateY((1 - b.flip) * Math.PI);
        if (burst > 0.01) bObj.rotateZ(burst * Math.sin(i * 3.7) * 2.5);
        const sFlip = 0.25 + 0.75 * ease.outBack(b.flip);
        bObj.scale.setScalar(b.v === 0 ? sFlip : 0.0001);
        bObj.updateMatrix();
        zeros.setMatrixAt(i, bObj.matrix);
        bObj.scale.setScalar(b.v === 1 ? sFlip : 0.0001);
        bObj.updateMatrix();
        ones.setMatrixAt(i, bObj.matrix);
      }
      zeros.instanceMatrix.needsUpdate = true;
      ones.instanceMatrix.needsUpdate = true;
      bitMat.emissiveIntensity = 0.22 + s.night * 0.25 + burst * 0.3;

      // ---- gövde hareketi ----
      const hop = poking ? Math.sin(Math.min(1, p / 0.35) * Math.PI) * 0.12 : 0;
      root.position.y = -0.08 + Math.sin(t * 1.1) * 0.03 * rm + hop;
      root.rotation.y = Math.sin(t * 0.35) * 0.12 * rm;
      root.rotation.z = Math.sin(t * 0.8) * 0.02 * rm + (poking ? Math.sin(p * 30) * 0.03 * (1 - p) : 0);
      ring.rotation.z = 0.12 + Math.sin(t * 0.4) * 0.05 * rm;
    },
  };
}
