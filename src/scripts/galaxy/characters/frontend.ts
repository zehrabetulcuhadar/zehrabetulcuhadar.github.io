import * as THREE from 'three';
import {
  canvasTexture,
  clay,
  clayBump,
  damp,
  ease,
  glow,
  OneShot,
  PAL,
  smooth,
  type Character,
  type CharacterState,
} from './kit';

/**
 * Frontend: üst üste binmiş renkli tarayıcı pencereleri ve UI düğmelerinden yapılmış bir gezegen.
 * Tepesinde parlayan uygulama ikonlarından minik bir şehir, etrafında ay gibi dönen kocaman kil fare imleci.
 * İmleç belirli aralıklarla dalıp bir düğmeye "tıklar": düğme içeri basar ve yanar.
 * Dürtünce pencereler responsive bir yerleşim gibi havalanıp yer değiştirir, ikon konfetisi patlar.
 */

const R = 0.9; // çekirdek küre yarıçapı

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

/** Küre üzerindeki yerel çerçeve: +z = dış normal, +y = yukarı. */
const _e = new THREE.Euler();
function frameQ(lat: number, lon: number, out = new THREE.Quaternion()) {
  _e.set(-lat, lon, 0, 'YXZ');
  return out.setFromEuler(_e);
}
function bendPoint(x: number, y: number, z: number, out: THREE.Vector3) {
  const lat = y / R;
  const lon = x / R;
  const r = R + z;
  return out.set(r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.cos(lon));
}

/**
 * Küreye sarılan yuvarlak köşeli kil levha (pencere/düğme). Geometri küre merkezine göredir;
 * mesh'e panelin frameQ dönüşü verilir. (cx, cy) panel içi konum, z0 panel yüzeyinden yükseklik.
 */
function slab(w: number, h: number, d: number, rc: number, b: number, cx = 0, cy = 0, z0 = 0) {
  const cs = 4;
  const J = 3;
  const M = 3;
  rc = Math.min(rc, w / 2 - 0.001, h / 2 - 0.001);
  b = Math.min(b, rc * 0.95, d * 0.9);
  const P: number[] = [];
  const Nn: number[] = [];
  const corners = [
    [w / 2 - rc, h / 2 - rc],
    [-w / 2 + rc, h / 2 - rc],
    [-w / 2 + rc, -h / 2 + rc],
    [w / 2 - rc, -h / 2 + rc],
  ];
  for (let c = 0; c < 4; c++) {
    for (let i = 0; i <= cs; i++) {
      const a = ((c + i / cs) * Math.PI) / 2;
      P.push(corners[c][0] + Math.cos(a) * rc, corners[c][1] + Math.sin(a) * rc);
      Nn.push(Math.cos(a), Math.sin(a));
    }
  }
  const N = P.length / 2;
  const rings: [number, number, number][] = []; // off, scale, z
  for (let j = 1; j <= J; j++) rings.push([-b, j / J, d]);
  for (let m = 1; m <= M; m++) {
    const f = ((m / M) * Math.PI) / 2;
    rings.push([-b + b * Math.sin(f), 1, d - b + b * Math.cos(f)]);
  }
  rings.push([0, 1, 0]);
  rings.push([0, 0.5, 0]);
  const pos: number[] = [0, 0, d];
  const uv: number[] = [0.5, 0.5];
  for (const [off, s, z] of rings) {
    for (let k = 0; k < N; k++) {
      const x = (P[k * 2] + Nn[k * 2] * off) * s;
      const y = (P[k * 2 + 1] + Nn[k * 2 + 1] * off) * s;
      pos.push(x, y, z);
      uv.push(x / w + 0.5, y / h + 0.5);
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < N; k++) idx.push(0, 1 + k, 1 + ((k + 1) % N));
  for (let r = 0; r < rings.length - 1; r++) {
    for (let k = 0; k < N; k++) {
      const k1 = (k + 1) % N;
      const a = 1 + r * N + k;
      const bb = 1 + (r + 1) * N + k;
      const c = 1 + (r + 1) * N + k1;
      const dd = 1 + r * N + k1;
      idx.push(a, bb, c, a, c, dd);
    }
  }
  // alt kapak (havalanınca içi görünmesin)
  const bc = pos.length / 3;
  pos.push(0, 0, 0);
  uv.push(0.5, 0.5);
  const last = 1 + (rings.length - 1) * N;
  for (let k = 0; k < N; k++) idx.push(bc, last + ((k + 1) % N), last + k);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.length; i += 3) {
    bendPoint(pos[i] + cx, pos[i + 1] + cy, pos[i + 2] + z0, v);
    pos[i] = v.x;
    pos[i + 1] = v.y;
    pos[i + 2] = v.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Instanced mesh'lerde örnek başına atlas hücresi (aCell = ofset.xy, ölçek.zw). */
function atlasPatch(m: THREE.Material, key: string) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aCell;').replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
#ifdef USE_MAP
vMapUv = vMapUv * aCell.zw + aCell.xy;
#endif
#ifdef USE_EMISSIVEMAP
vEmissiveMapUv = vEmissiveMapUv * aCell.zw + aCell.xy;
#endif`,
    );
  };
  m.customProgramCacheKey = () => key;
}

function rr(x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number, fill: string) {
  x.fillStyle = fill;
  x.beginPath();
  x.roundRect(X, Y, W, H, Math.min(r, W / 2, H / 2));
  x.fill();
}

function texMat(map: THREE.Texture, emissive = 0.1) {
  return new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: '#ffffff',
    emissiveIntensity: emissive,
    roughness: 0.82,
    metalness: 0,
    bumpMap: clayBump(),
    bumpScale: 0.5,
  });
}

/** Şehir binaları için yumuşak köşeli birim kutu (taban y=0... merkezli, 1x1x1). */
function roundUnit() {
  const shape = new THREE.Shape();
  const r = 0.22;
  const h = 0.5 - r;
  shape.moveTo(-h, -0.5);
  shape.lineTo(h, -0.5);
  shape.quadraticCurveTo(0.5, -0.5, 0.5, -h);
  shape.lineTo(0.5, h);
  shape.quadraticCurveTo(0.5, 0.5, h, 0.5);
  shape.lineTo(-h, 0.5);
  shape.quadraticCurveTo(-0.5, 0.5, -0.5, h);
  shape.lineTo(-0.5, -h);
  shape.quadraticCurveTo(-0.5, -0.5, -h, -0.5);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.84,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.06,
    bevelSegments: 2,
    curveSegments: 3,
  });
  g.translate(0, 0, -0.42);
  g.rotateX(-Math.PI / 2);
  g.scale(0.9, 1, 0.9);
  return g;
}

const COLS = [PAL.coral, PAL.butter, PAL.pink, PAL.mint, PAL.leaf, PAL.periwinkle, PAL.lilac, PAL.apricot, PAL.sky];
const DOTS = ['#F2766B', '#F7C548', '#8FD694'];

export default function create(): Character {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const rand = rng(7);
  const font = (px: number) => `800 ${px}px "Trebuchet MS", system-ui, sans-serif`;

  // ---------- çekirdek: UI mozaiği dokulu küre ----------
  const mosaic = canvasTexture(1024, 512, (x, w, h) => {
    x.fillStyle = '#B9B4EA';
    x.fillRect(0, 0, w, h);
    let y = 0;
    while (y < h) {
      const rh = 22 + Math.floor(rand() * 18);
      let xx = -rand() * 40;
      while (xx < w) {
        const cw = 26 + rand() * 90;
        const c = COLS[Math.floor(rand() * COLS.length)];
        rr(x, xx + 3, y + 3, cw - 6, rh - 6, 6, c);
        x.fillStyle = 'rgba(255,255,255,0.55)';
        const kind = rand();
        if (kind < 0.4) {
          for (let l = 0; l < 2; l++)
            rr(x, xx + 9, y + 8 + l * 7, (cw - 22) * (0.5 + rand() * 0.5), 3, 2, 'rgba(255,255,255,0.6)');
        } else if (kind < 0.7) {
          for (let d = 0; d < 3; d++) {
            x.beginPath();
            x.arc(xx + 11 + d * 7, y + rh / 2, 2.4, 0, Math.PI * 2);
            x.fill();
          }
        } else {
          rr(x, xx + 8, y + 7, Math.max(6, cw - 16), rh - 14, 4, 'rgba(62,31,56,0.18)');
        }
        xx += cw;
      }
      y += rh;
    }
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(R, 72, 48), texMat(mosaic, 0.06));
  body.add(core);

  // ---------- pencere atlası (8 tasarım) ----------
  const AC = 4;
  const AR = 2;
  const atlas = canvasTexture(1024, 384, (x) => {
    const frames = [PAL.periwinkle, PAL.coral, PAL.mint, PAL.butter, PAL.pink, PAL.sky, PAL.lilac, PAL.apricot];
    for (let i = 0; i < 8; i++) {
      const X = (i % AC) * 256;
      const Y = Math.floor(i / AC) * 192;
      x.fillStyle = frames[i];
      x.fillRect(X, Y, 256, 192);
      DOTS.forEach((c, k) => {
        x.fillStyle = c;
        x.beginPath();
        x.arc(X + 30 + k * 16, Y + 30, 6, 0, Math.PI * 2);
        x.fill();
      });
      rr(x, X + 84, Y + 23, 140, 14, 7, 'rgba(255,255,255,0.65)');
      const cx = X + 22;
      const cy = Y + 48;
      rr(x, cx, cy, 212, 122, 12, PAL.paper);
      const ink = 'rgba(62,31,56,0.28)';
      switch (i) {
        case 0: // görsel + metin
          rr(x, cx + 10, cy + 10, 92, 70, 8, PAL.sky);
          x.fillStyle = PAL.leaf;
          x.beginPath();
          x.moveTo(cx + 10, cy + 80);
          x.lineTo(cx + 45, cy + 40);
          x.lineTo(cx + 70, cy + 64);
          x.lineTo(cx + 82, cy + 52);
          x.lineTo(cx + 102, cy + 80);
          x.fill();
          x.fillStyle = PAL.butter;
          x.beginPath();
          x.arc(cx + 80, cy + 28, 9, 0, Math.PI * 2);
          x.fill();
          for (let l = 0; l < 5; l++) rr(x, cx + 114, cy + 14 + l * 15, 86 - (l % 2) * 26, 7, 4, ink);
          rr(x, cx + 10, cy + 92, 60, 18, 9, PAL.coral);
          break;
        case 1: // form
          for (let l = 0; l < 3; l++) {
            rr(x, cx + 12, cy + 10 + l * 30, 50, 6, 3, ink);
            rr(x, cx + 12, cy + 19 + l * 30, 188, 12, 6, '#E9E4F7');
          }
          rr(x, cx + 120, cy + 98, 80, 18, 9, PAL.mint);
          break;
        case 2: // video
          rr(x, cx + 10, cy + 10, 192, 84, 10, '#5B4A7A');
          x.fillStyle = '#fff';
          x.beginPath();
          x.moveTo(cx + 96, cy + 36);
          x.lineTo(cx + 96, cy + 68);
          x.lineTo(cx + 122, cy + 52);
          x.fill();
          rr(x, cx + 10, cy + 104, 192, 7, 4, ink);
          rr(x, cx + 10, cy + 104, 110, 7, 4, PAL.coral);
          break;
        case 3: // kart ızgarası
          for (let r = 0; r < 2; r++)
            for (let c = 0; c < 3; c++) {
              rr(x, cx + 10 + c * 66, cy + 10 + r * 56, 58, 48, 8, COLS[(r * 3 + c + 2) % COLS.length]);
              rr(x, cx + 18 + c * 66, cy + 44 + r * 56, 34, 6, 3, 'rgba(255,255,255,0.7)');
            }
          break;
        case 4: // grafik
          for (let c = 0; c < 7; c++) {
            const bh = 20 + ((c * 37) % 70);
            rr(x, cx + 16 + c * 27, cy + 108 - bh, 18, bh, 5, COLS[c % COLS.length]);
          }
          break;
        case 5: {
          // kod editörü
          const cc = [PAL.periwinkle, PAL.coral, PAL.mint, PAL.apricot, PAL.lilac, PAL.pink];
          for (let l = 0; l < 7; l++) {
            const ind = [0, 1, 2, 2, 1, 2, 0][l] * 16;
            rr(x, cx + 12 + ind, cy + 10 + l * 15, 22 + ((l * 29) % 50), 8, 4, cc[l % 6]);
            rr(x, cx + 40 + ind + ((l * 29) % 50), cy + 10 + l * 15, 40 + ((l * 13) % 40), 8, 4, ink);
          }
          break;
        }
        case 6: // sohbet
          rr(x, cx + 10, cy + 10, 120, 26, 13, '#E9E4F7');
          rr(x, cx + 80, cy + 44, 122, 26, 13, PAL.sky);
          rr(x, cx + 10, cy + 78, 96, 26, 13, '#E9E4F7');
          rr(x, cx + 150, cy + 92, 52, 18, 9, PAL.pink);
          break;
        default: // profil kartı
          x.fillStyle = PAL.lilac;
          x.beginPath();
          x.arc(cx + 50, cy + 52, 32, 0, Math.PI * 2);
          x.fill();
          x.fillStyle = PAL.paper;
          x.beginPath();
          x.arc(cx + 50, cy + 44, 11, 0, Math.PI * 2);
          x.fill();
          x.beginPath();
          x.arc(cx + 50, cy + 76, 20, Math.PI, 0);
          x.fill();
          for (let l = 0; l < 3; l++) rr(x, cx + 100, cy + 26 + l * 16, 96 - l * 20, 8, 4, ink);
          rr(x, cx + 100, cy + 90, 70, 18, 9, PAL.butter);
      }
    }
  });
  const winMat = texMat(atlas, 0.08);
  atlasPatch(winMat, 'fe-atlas-std');

  // ---------- kahraman paneller ----------
  const HERO = { lat: -0.04, lon: 0.3 };
  const VID = { lat: 0.22, lon: 1.22 };
  const LOAD = { lat: 0.42, lon: -0.6 };
  const qHero = frameQ(HERO.lat, HERO.lon);
  const qVid = frameQ(VID.lat, VID.lon);
  const qLoad = frameQ(LOAD.lat, LOAD.lon);
  const PT = 0.06; // panel kalınlığı
  const PB = 0.012; // panel tabanı küreden yükseklik
  const HZ = PB + PT; // panel yüzeyi

  const heroTex = canvasTexture(512, 544, (x, w, h) => {
    x.fillStyle = PAL.lilac;
    x.fillRect(0, 0, w, h);
    DOTS.forEach((c, k) => {
      x.fillStyle = c;
      x.beginPath();
      x.arc(40 + k * 24, 38, 9, 0, Math.PI * 2);
      x.fill();
    });
    rr(x, 130, 26, 340, 24, 12, 'rgba(255,255,255,0.7)');
    x.fillStyle = 'rgba(62,31,56,0.45)';
    x.font = font(15);
    x.fillText('https://zero.dev', 146, 44);
    rr(x, 26, 66, w - 52, h - 92, 22, PAL.paper);
    const ink = 'rgba(62,31,56,0.32)';
    rr(x, 56, 236, 120, 12, 6, ink);
    rr(x, 56, 256, 80, 9, 5, 'rgba(62,31,56,0.16)');
    rr(x, 56, 300, 90, 10, 5, ink);
    rr(x, 56, 492, 180, 9, 5, 'rgba(62,31,56,0.16)');
    rr(x, 300, 492, 120, 9, 5, 'rgba(62,31,56,0.16)');
    x.fillStyle = PAL.ink;
    x.font = font(30);
    x.fillText('Hello, Zero!', 56, 106);
  });
  const hero = new THREE.Mesh(slab(0.94, 1.0, PT, 0.1, 0.04, 0, 0, PB), texMat(heroTex, 0.08));
  hero.quaternion.copy(qHero);
  body.add(hero);

  // giriş alanı + yanıp sönen imleç
  const inputTex = canvasTexture(256, 64, (x, w, h) => {
    x.fillStyle = '#ECE7FA';
    x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(62,31,56,0.4)';
    x.font = font(24);
    x.fillText('search…', 24, h / 2 + 9);
  });
  const input = new THREE.Mesh(slab(0.56, 0.12, 0.02, 0.06, 0.012, -0.12, 0.19, HZ), texMat(inputTex, 0.1));
  input.quaternion.copy(qHero);
  body.add(input);
  const caretMat = glow(PAL.periwinkle, 0.9, false);
  const caret = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), caretMat);
  hero.add(caret);

  // düğmeler (tıklama hedefleri)
  type Btn = {
    mesh: THREE.Mesh;
    mat: THREE.MeshStandardMaterial;
    q: THREE.Quaternion;
    n: THREE.Vector3;
    tip: THREE.Vector3;
    press: number;
    lit: number;
  };
  const btns: Btn[] = [];
  function makeBtn(
    panelQ: THREE.Quaternion,
    cx: number,
    cy: number,
    w: number,
    h: number,
    color: string,
    draw: (x: CanvasRenderingContext2D, w: number, h: number) => void,
  ) {
    const big = Math.max(w, h);
    const tex = canvasTexture(Math.round((512 * w) / big), Math.round((512 * h) / big), (x, W, H) => {
      x.fillStyle = color;
      x.fillRect(0, 0, W, H);
      draw(x, W, H);
    });
    const mat = texMat(tex, 0.1);
    const mesh = new THREE.Mesh(slab(w, h, 0.07, Math.min(w, h) / 2, 0.03, cx, cy, HZ), mat);
    mesh.quaternion.copy(panelQ);
    body.add(mesh);
    const q = panelQ.clone().multiply(frameQ(cy / R, cx / R));
    const n = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const tip = bendPoint(cx, cy, HZ + 0.07, new THREE.Vector3()).applyQuaternion(panelQ);
    btns.push({ mesh, mat, q, n, tip, press: 0, lit: 0 });
  }
  const label = (txt: string, px: number) => (x: CanvasRenderingContext2D, W: number, H: number) => {
    x.fillStyle = '#fff';
    x.font = font(px);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(txt, W / 2, H / 2 + px * 0.06);
  };
  const lens = (x: CanvasRenderingContext2D, W: number, H: number) => {
    x.strokeStyle = '#fff';
    x.lineWidth = W * 0.09;
    x.lineCap = 'round';
    x.beginPath();
    x.arc(W * 0.45, H * 0.45, W * 0.18, 0, Math.PI * 2);
    x.stroke();
    x.beginPath();
    x.moveTo(W * 0.58, H * 0.58);
    x.lineTo(W * 0.72, H * 0.72);
    x.stroke();
  };
  makeBtn(qHero, 0.28, 0.19, 0.15, 0.13, PAL.periwinkle, lens); // 0: search
  makeBtn(qHero, 0, -0.33, 0.5, 0.15, PAL.coral, label('submit', 110)); // 1: submit

  // açma/kapama
  const togTrackMat = new THREE.MeshStandardMaterial({
    color: PAL.steel,
    roughness: 0.8,
    bumpMap: clayBump(),
    bumpScale: 0.5,
  });
  const togTrack = new THREE.Mesh(slab(0.2, 0.1, 0.035, 0.05, 0.015, 0.24, 0.03, HZ), togTrackMat);
  togTrack.quaternion.copy(qHero);
  body.add(togTrack);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), clay(PAL.white));
  body.add(knob);
  const togOn = new THREE.Color(PAL.mint);
  const togOff = new THREE.Color('#CFC9E0');

  // kaydırıcı
  const sliderTex = canvasTexture(256, 16, (x, w, h) => {
    x.fillStyle = PAL.apricot;
    x.fillRect(0, 0, w / 2, h);
    x.fillStyle = '#DCD6EE';
    x.fillRect(w / 2, 0, w / 2, h);
  });
  sliderTex.wrapS = THREE.ClampToEdgeWrapping;
  const slTrack = new THREE.Mesh(slab(0.66, 0.045, 0.025, 0.022, 0.01, 0, -0.14, HZ), texMat(sliderTex, 0.08));
  slTrack.quaternion.copy(qHero);
  body.add(slTrack);
  const slKnob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 14), clay(PAL.white));
  body.add(slKnob);
  const slRing = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 8, 24), clay(PAL.apricot));
  body.add(slRing);

  // video penceresi + oynat
  const vidTex = canvasTexture(384, 300, (x, w, h) => {
    x.fillStyle = PAL.sky;
    x.fillRect(0, 0, w, h);
    DOTS.forEach((c, k) => {
      x.fillStyle = c;
      x.beginPath();
      x.arc(30 + k * 20, 28, 7, 0, Math.PI * 2);
      x.fill();
    });
    rr(x, 20, 50, w - 40, h - 70, 16, '#4E3F6E');
    for (let i = 0; i < 6; i++) rr(x, 40 + i * 52, 70, 34, 120, 8, 'rgba(255,255,255,0.06)');
    rr(x, 40, h - 50, w - 80, 8, 4, 'rgba(255,255,255,0.3)');
  });
  const vid = new THREE.Mesh(slab(0.6, 0.47, PT, 0.08, 0.035, 0, 0, PB), texMat(vidTex, 0.1));
  vid.quaternion.copy(qVid);
  body.add(vid);
  makeBtn(qVid, 0, 0.03, 0.17, 0.17, PAL.mint, (x, W, H) => {
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(W * 0.4, H * 0.3);
    x.lineTo(W * 0.4, H * 0.7);
    x.lineTo(W * 0.72, H * 0.5);
    x.fill();
  }); // 2: play
  const playhead = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), clay(PAL.coral, { emissive: 0.3 }));
  body.add(playhead);

  // yükleniyor penceresi + spinner
  const loadTex = canvasTexture(320, 256, (x, w, h) => {
    x.fillStyle = PAL.butter;
    x.fillRect(0, 0, w, h);
    ['#F2766B', '#FFFFFF', '#8FD694'].forEach((c, k) => {
      x.fillStyle = c;
      x.beginPath();
      x.arc(28 + k * 18, 26, 6, 0, Math.PI * 2);
      x.fill();
    });
    rr(x, 18, 46, w - 36, h - 64, 14, PAL.paper);
    rr(x, 60, h - 54, w - 120, 9, 5, 'rgba(62,31,56,0.18)');
    rr(x, 60, h - 54, (w - 120) * 0.62, 9, 5, PAL.pink);
  });
  const load = new THREE.Mesh(slab(0.5, 0.4, PT, 0.07, 0.03, 0, 0, PB), texMat(loadTex, 0.1));
  load.quaternion.copy(qLoad);
  body.add(load);
  const spinTex = canvasTexture(128, 128, (x) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      x.fillStyle = `rgba(124,140,242,${0.15 + (i / 10) * 0.85})`;
      x.beginPath();
      x.arc(64 + Math.cos(a) * 42, 64 - Math.sin(a) * 42, 6 + (i / 10) * 7, 0, Math.PI * 2);
      x.fill();
    }
  });
  const spinPivot = new THREE.Group();
  spinPivot.quaternion.copy(qLoad).multiply(frameQ(0.025 / R, 0));
  body.add(spinPivot);
  const spinner = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, 0.2),
    new THREE.MeshBasicMaterial({ map: spinTex, transparent: true, depthWrite: false }),
  );
  spinner.position.z = R + HZ + 0.006;
  spinPivot.add(spinner);

  // ---------- dolgu pencereler (instanced, iki boy) ----------
  type Win = {
    size: number;
    slot: number;
    lat: number;
    lon: number;
    fromLat: number;
    fromLon: number;
    r0: number;
    i: number;
  };
  const zones = [
    { lat: HERO.lat, lon: HERO.lon, r: 0.62 },
    { lat: VID.lat, lon: VID.lon, r: 0.36 },
    { lat: LOAD.lat, lon: LOAD.lon, r: 0.31 },
  ];
  const angDist = (la1: number, lo1: number, la2: number, lo2: number) =>
    Math.acos(Math.min(1, Math.sin(la1) * Math.sin(la2) + Math.cos(la1) * Math.cos(la2) * Math.cos(lo1 - lo2)));
  const slots: { lat: number; lon: number; size: number }[] = [];
  const bands = [0.76, 0.3, -0.15, -0.6, -1.02];
  bands.forEach((lat, bi) => {
    const n = Math.max(4, Math.round((2 * Math.PI * Math.cos(lat) * R) / 0.5));
    const off = bi * 0.37;
    for (let i = 0; i < n; i++) {
      const lon = off + (i / n) * Math.PI * 2;
      const size = (i + bi) % 3 === 0 ? 1 : 0;
      const half = size ? 0.2 : 0.29;
      if (zones.some((z) => angDist(lat, lon, z.lat, z.lon) < z.r + half)) continue;
      slots.push({ lat: lat + (rand() - 0.5) * 0.06, lon: lon + (rand() - 0.5) * 0.08, size });
    }
  });
  const wins: Win[] = slots.map((s, i) => ({
    size: s.size,
    slot: i,
    lat: s.lat,
    lon: s.lon,
    fromLat: s.lat,
    fromLon: s.lon,
    r0: (i % 3) * 0.012,
    i,
  }));
  const sizes = [
    { w: 0.56, h: 0.42 },
    { w: 0.38, h: 0.3 },
  ];
  const winMeshes = sizes.map((sz, si) => {
    const list = wins.filter((w) => w.size === si);
    const g = slab(sz.w, sz.h, 0.055, 0.07, 0.03, 0, 0, PB);
    const cell = new Float32Array(list.length * 4);
    list.forEach((w, k) => {
      const c = (w.i * 5 + si * 3) % 8;
      const inset = 0.004;
      cell.set(
        [(c % AC) / AC + inset, 1 - (Math.floor(c / AC) + 1) / AR + inset, 1 / AC - inset * 2, 1 / AR - inset * 2],
        k * 4,
      );
    });
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 4));
    const im = new THREE.InstancedMesh(g, winMat, list.length);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    body.add(im);
    return { im, list };
  });

  // ---------- tepede uygulama ikonu şehri ----------
  const city = new THREE.Group();
  city.position.y = 0.8;
  body.add(city);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.13, 40, 1), clay(PAL.periwinkle));
  plat.position.y = 0.065;
  city.add(plat);
  const platRim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.022, 8, 48), clay(PAL.lilac));
  platRim.rotation.x = Math.PI / 2;
  platRim.position.y = 0.13;
  city.add(platRim);
  const CT = 0.13; // platform üstü
  const iconAtlas = canvasTexture(512, 256, (x) => {
    for (let i = 0; i < 8; i++) {
      x.save();
      x.translate((i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 64);
      x.shadowColor = 'rgba(255,255,255,0.9)';
      x.shadowBlur = 14;
      x.fillStyle = '#fff';
      x.strokeStyle = '#fff';
      x.lineWidth = 12;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.beginPath();
      switch (i) {
        case 0: // kalp
          x.moveTo(0, 30);
          x.bezierCurveTo(-50, -5, -28, -42, 0, -18);
          x.bezierCurveTo(28, -42, 50, -5, 0, 30);
          x.fill();
          break;
        case 1: // yıldız
          for (let k = 0; k < 10; k++) {
            const a = -Math.PI / 2 + (k * Math.PI) / 5;
            const r = k % 2 ? 16 : 38;
            x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          x.fill();
          break;
        case 2: // oynat
          x.moveTo(-18, -28);
          x.lineTo(-18, 28);
          x.lineTo(30, 0);
          x.fill();
          break;
        case 3: // sohbet
          x.roundRect(-36, -28, 72, 46, 16);
          x.moveTo(-14, 16);
          x.lineTo(-22, 34);
          x.lineTo(4, 16);
          x.fill();
          break;
        case 4: // dişli
          for (let k = 0; k < 16; k++) {
            const a = (k * Math.PI) / 8;
            const r = k % 2 ? 26 : 38;
            x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          x.fill();
          x.globalCompositeOperation = 'destination-out';
          x.beginPath();
          x.arc(0, 0, 11, 0, Math.PI * 2);
          x.fill();
          x.globalCompositeOperation = 'source-over';
          break;
        case 5: // nota
          x.arc(-12, 22, 13, 0, Math.PI * 2);
          x.fill();
          x.beginPath();
          x.moveTo(-1, 22);
          x.lineTo(-1, -30);
          x.lineTo(24, -20);
          x.stroke();
          break;
        case 6: // büyüteç
          x.arc(-6, -6, 20, 0, Math.PI * 2);
          x.stroke();
          x.beginPath();
          x.moveTo(10, 10);
          x.lineTo(30, 30);
          x.stroke();
          break;
        default: // kamera
          x.roundRect(-36, -20, 72, 46, 10);
          x.fill();
          x.fillRect(-12, -30, 24, 12);
          x.globalCompositeOperation = 'destination-out';
          x.beginPath();
          x.arc(0, 3, 13, 0, Math.PI * 2);
          x.fill();
          x.globalCompositeOperation = 'source-over';
      }
      x.restore();
    }
  });
  const cellOf = (i: number) => [(i % 4) / 4, 1 - (Math.floor(i / 4) + 1) / 2, 1 / 4, 1 / 2];
  const front = 0.3; // kameraya bakan boylam
  type Bld = { x: number; z: number; w: number; h: number; a: number; c: string };
  const blds: Bld[] = [];
  const NB = 11;
  for (let i = 0; i < NB; i++) {
    const a = front + (i / NB) * Math.PI * 2 + 0.15;
    const back = (1 - Math.cos(a - front)) / 2;
    const rad = 0.26 + (i % 2) * 0.04;
    blds.push({
      x: Math.sin(a) * rad,
      z: Math.cos(a) * rad,
      w: 0.1 + (i % 3) * 0.012,
      h: 0.08 + back * 0.2 + (i % 2) * 0.03,
      a,
      c: COLS[(i * 4) % COLS.length],
    });
  }
  const bldMesh = new THREE.InstancedMesh(roundUnit(), clay(PAL.white), NB);
  const iconMat = new THREE.MeshBasicMaterial({ map: iconAtlas, transparent: true, depthWrite: false });
  atlasPatch(iconMat, 'fe-atlas-basic');
  const iconGeo = new THREE.PlaneGeometry(1, 1);
  const iconCells = new Float32Array(NB * 4);
  const bm = new THREE.Matrix4();
  const bq = new THREE.Quaternion();
  const bs = new THREE.Vector3();
  const bp = new THREE.Vector3();
  const col = new THREE.Color();
  const Y = new THREE.Vector3(0, 1, 0);
  const iconBase: THREE.Matrix4[] = [];
  blds.forEach((b, i) => {
    bq.setFromAxisAngle(Y, b.a);
    bp.set(b.x, CT + b.h / 2, b.z);
    bs.set(b.w, b.h, b.w);
    bm.compose(bp, bq, bs);
    bldMesh.setMatrixAt(i, bm);
    bldMesh.setColorAt(i, col.set(b.c));
    iconCells.set(cellOf(i % 8), i * 4);
    const ip = new THREE.Vector3(Math.sin(b.a), 0, Math.cos(b.a)).multiplyScalar(b.w / 2 + 0.008);
    ip.add(new THREE.Vector3(b.x, CT + b.h * 0.55, b.z));
    const s = Math.min(b.w * 0.8, b.h * 0.75);
    iconBase.push(new THREE.Matrix4().compose(ip, bq.clone(), new THREE.Vector3(s, s, 1)));
  });
  city.add(bldMesh);
  iconGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(iconCells, 4));
  const iconMesh = new THREE.InstancedMesh(iconGeo, iconMat, NB);
  iconBase.forEach((m, i) => iconMesh.setMatrixAt(i, m));
  city.add(iconMesh);
  // merkezde ev
  const houseTex = canvasTexture(128, 128, (x) => {
    x.fillStyle = PAL.butter;
    x.fillRect(0, 0, 128, 128);
    rr(x, 50, 62, 28, 66, 8, '#FFE9A8');
    rr(x, 14, 30, 24, 24, 5, '#FFF6D0');
    rr(x, 90, 30, 24, 24, 5, '#FFF6D0');
  });
  const houseMat = texMat(houseTex, 0.15);
  const house = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.15, 0.15), houseMat);
  house.position.set(0, CT + 0.075, 0.02);
  house.rotation.y = front;
  city.add(house);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.11, 4), clay(PAL.coral));
  roof.position.set(0, CT + 0.2, 0.02);
  roof.rotation.y = front + Math.PI / 4;
  city.add(roof);
  // anten + işaret ışıkları
  const tallest = blds.reduce((a, b) => (b.h > a.h ? b : a));
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 6), clay(PAL.steel));
  antenna.position.set(tallest.x, CT + tallest.h + 0.07, tallest.z);
  city.add(antenna);
  const beaconMat = glow('#FFE38A', 0.9);
  const beaconSpots = blds
    .filter((b) => b !== tallest)
    .sort((a, b) => b.h - a.h)
    .slice(0, 5)
    .map((b) => new THREE.Vector3(b.x, CT + b.h + 0.018, b.z));
  beaconSpots.push(new THREE.Vector3(tallest.x, CT + tallest.h + 0.15, tallest.z));
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 10, 8), beaconMat, beaconSpots.length);
  city.add(beacons);

  // ---------- fare imleci (ay) ----------
  const orbit = new THREE.Group();
  orbit.rotation.set(-Math.PI / 2 + 0.38, 0, 0.18);
  body.add(orbit);
  orbit.updateMatrix();
  const OR = 1.38;
  const trailTex = canvasTexture(256, 4, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
  trailTex.wrapS = THREE.RepeatWrapping;
  const trailMat = new THREE.MeshBasicMaterial({
    map: trailTex,
    color: '#C9C2FF',
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const trail = new THREE.Mesh(new THREE.TorusGeometry(OR, 0.016, 6, 160), trailMat);
  orbit.add(trail);
  const faint = new THREE.Mesh(new THREE.TorusGeometry(OR, 0.006, 4, 160), glow('#B9A6D6', 0.25, false));
  orbit.add(faint);

  const cshape = new THREE.Shape();
  const CP: [number, number][] = [
    [0, 0],
    [0, -1],
    [0.26, -0.76],
    [0.44, -1.13],
    [0.62, -1.05],
    [0.45, -0.68],
    [0.76, -0.68],
  ];
  cshape.moveTo(CP[0][0], CP[0][1]);
  for (let i = 1; i < CP.length; i++) cshape.lineTo(CP[i][0], CP[i][1]);
  cshape.closePath();
  const CSZ = 0.47;
  const curGeo = new THREE.ExtrudeGeometry(cshape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 4,
  });
  curGeo.scale(CSZ, CSZ, CSZ);
  const cursor = new THREE.Group();
  body.add(cursor);
  const curInner = new THREE.Group();
  cursor.add(curInner);
  const cur = new THREE.Mesh(curGeo, clay('#FBFAFF'));
  cur.position.z = 0.03;
  curInner.add(cur);
  const outline = new THREE.Mesh(curGeo, clay('#9A93B8'));
  const cen = new THREE.Vector3(0.3, -0.75, 0).multiplyScalar(CSZ);
  outline.scale.set(1.16, 1.16, 0.7);
  outline.position.set(-cen.x * 0.16, -cen.y * 0.16, -0.01);
  curInner.add(outline);

  const rippleMat = glow('#FFFFFF', 0, true);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.085, 32), rippleMat);
  body.add(ripple);

  // ---------- ikon konfetisi ----------
  const NC = 42;
  const confGeo = new THREE.PlaneGeometry(1, 1);
  const confCells = new Float32Array(NC * 4);
  const conf: { o: THREE.Vector3; d: THREE.Vector3; spin: number; s: number; delay: number }[] = [];
  for (let i = 0; i < NC; i++) {
    confCells.set(cellOf(i % 8), i * 4);
    const fromCity = i % 3 !== 0;
    const d = fromCity
      ? new THREE.Vector3(rand() - 0.5, rand() * 0.9 + 0.2, rand() - 0.5).normalize()
      : new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() * 0.6 + 0.4).normalize();
    conf.push({
      o: fromCity ? new THREE.Vector3(0, 1.0, 0) : d.clone().multiplyScalar(0.95),
      d,
      spin: (rand() - 0.5) * 8,
      s: 0.11 + rand() * 0.07,
      delay: rand() * 0.25,
    });
  }
  confGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(confCells, 4));
  const confMat = new THREE.MeshBasicMaterial({
    map: iconAtlas,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  atlasPatch(confMat, 'fe-atlas-basic');
  const confMesh = new THREE.InstancedMesh(confGeo, confMat, NC);
  for (let i = 0; i < NC; i++) confMesh.setColorAt(i, col.set(COLS[i % COLS.length]));
  confMesh.visible = false;
  confMesh.frustumCulled = false;
  body.add(confMesh);

  // ---------- durum ----------
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const q1 = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const m1 = new THREE.Matrix4();
  const m2 = new THREE.Matrix4();
  const mz = new THREE.Matrix4();
  const lZ = new THREE.Vector3(0, 0, 1);
  const pl = new THREE.Vector3(-0.33, 0.94, 0).normalize();
  const plB = new THREE.Vector3().crossVectors(lZ, pl);
  const mLocalT = new THREE.Matrix4().makeBasis(pl, plB, lZ).transpose();
  const camQ = new THREE.Quaternion();
  const parentQ = new THREE.Quaternion();

  const orbitPos = (a: number, out: THREE.Vector3) =>
    out.set(Math.cos(a) * OR, Math.sin(a) * OR, 0).applyMatrix4(orbit.matrix);
  // imlecin kahraman panelin önünden geçtiği açı
  let thFront = 0;
  {
    let best = -2;
    const heroN = new THREE.Vector3(0, 0, 1).applyQuaternion(qHero);
    for (let i = 0; i < 360; i++) {
      const a = (i / 360) * Math.PI * 2;
      const d = orbitPos(a, v1).normalize().dot(heroN);
      if (d > best) {
        best = d;
        thFront = a;
      }
    }
  }
  const TAU = Math.PI * 2;
  let th = thFront - 1.2;
  let diving = -1;
  let lastLap = Math.floor((th - thFront) / TAU);
  let target = 1;
  const order = [1, 0, 2]; // submit, search, play
  let orderI = 0;
  let clicked = false;
  let rippleT = -1;
  let spinA = 0;
  let tog = 0;
  let togTarget = 1;
  let togTimer = 1.2;
  let playProg = 0.2;
  let playBoost = 0;
  let hov = 0;
  let curSpin = 0;
  let focusI = 0;
  let focusT = 0;
  const pk = new OneShot(2.8);
  const DIVE = 1.9;

  function poke() {
    pk.start();
    for (let si = 0; si < 2; si++) {
      const list = winMeshes[si].list;
      const ids = list.map((w) => w.slot);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      list.forEach((w, k) => {
        w.fromLat = w.lat;
        w.fromLon = w.lon;
        w.slot = ids[k];
      });
    }
  }

  function update(s: CharacterState) {
    const dt = s.dt;
    const t = s.t;
    const sp = s.reduce ? 0.25 : 1;
    hov = damp(hov, s.hover, 6, dt);
    const night = s.night;
    const P = pk.tick(dt);

    // gövde: yavaş sallanma + süzülme + dürtme zıplaması
    body.rotation.y = -0.12 + 0.2 * Math.sin(t * 0.28 * sp);
    body.position.y = 0.03 * Math.sin(t * 0.9 * sp);
    let sq = 0;
    if (P >= 0)
      sq =
        P < 0.12
          ? -Math.sin((P / 0.12) * Math.PI) * 0.07
          : 0.05 * Math.sin((P - 0.12) * 22) * Math.exp(-(P - 0.12) * 9);
    body.scale.set(1 - sq * 0.6, 1 + sq, 1 - sq * 0.6);

    // ---- pencereler ----
    focusT += dt * (0.8 + hov * 1.4) * sp;
    if (focusT > 1) {
      focusT = 0;
      focusI = Math.floor(rand() * wins.length);
    }
    for (const { im, list } of winMeshes) {
      for (let k = 0; k < list.length; k++) {
        const w = list[k];
        const sl = slots[w.slot];
        let lift = (0.006 + hov * 0.014) * Math.sin(t * 1.3 * sp + w.i * 1.7);
        let roll = 0;
        let scl = 1;
        if (w.i === focusI) lift += 0.04 * Math.sin(focusT * Math.PI);
        if (P >= 0) {
          const lp = Math.min(1, Math.max(0, (P - 0.05 - (w.i % 9) * 0.025) / 0.7));
          const up = Math.sin(Math.min(1, lp * 1.15) * Math.PI);
          lift += 0.3 * up;
          roll = 0.5 * Math.sin(lp * Math.PI) * (w.i % 2 ? 1 : -1);
          scl = 1 + 0.15 * up;
          const mv = ease.inOut(smooth(0.15, 0.8, lp));
          const dl = Math.atan2(Math.sin(sl.lon - w.fromLon), Math.cos(sl.lon - w.fromLon));
          w.lat = w.fromLat + (sl.lat - w.fromLat) * mv;
          w.lon = w.fromLon + dl * mv;
        } else {
          w.lat = damp(w.lat, sl.lat, 4, dt);
          w.lon += Math.atan2(Math.sin(sl.lon - w.lon), Math.cos(sl.lon - w.lon)) * (1 - Math.exp(-4 * dt));
        }
        frameQ(w.lat, w.lon, q1);
        m1.makeRotationFromQuaternion(q1);
        const pivot = R + PB;
        m1.multiply(m2.makeTranslation(0, 0, pivot + lift + w.r0));
        m1.multiply(mz.makeRotationZ(roll));
        m1.multiply(mz.makeScale(scl, scl, scl));
        m1.multiply(m2.makeTranslation(0, 0, -pivot));
        im.setMatrixAt(k, m1);
      }
      im.instanceMatrix.needsUpdate = true;
    }
    winMat.emissiveIntensity = 0.06 + night * 0.32 + hov * 0.06;

    // ---- açma/kapama ----
    togTimer += dt * sp * (1 + hov * 0.9 + (P >= 0 ? 4 : 0));
    if (togTimer > 2.4) {
      togTimer = 0;
      togTarget = 1 - togTarget;
    }
    tog = damp(tog, togTarget, 9, dt);
    togTrackMat.color.copy(togOff).lerp(togOn, tog);
    {
      const x = 0.19 + 0.1 * tog;
      bendPoint(x, 0.03, HZ + 0.04, knob.position).applyQuaternion(qHero);
      const sqk = Math.sin(tog * Math.PI) * 0.25;
      knob.scale.set(1 + sqk, 1 - sqk * 0.5, 1);
      knob.quaternion.copy(qHero);
    }

    // ---- kaydırıcı ----
    let sv = 0.5 + 0.32 * Math.sin(t * 0.7 * sp) + 0.1 * Math.sin(t * 1.9 * sp) * hov;
    if (P >= 0) sv = 0.5 + 0.45 * Math.sin(P * Math.PI * 3);
    sliderTex.offset.x = 0.5 - sv;
    {
      const x = -0.31 + 0.62 * sv;
      bendPoint(x, -0.14, HZ + 0.035, slKnob.position).applyQuaternion(qHero);
      slRing.position.copy(slKnob.position);
      slRing.quaternion.copy(qHero).multiply(frameQ(-0.14 / R, x / R, q2));
    }

    // ---- caret ----
    {
      const cx = -0.34;
      bendPoint(cx, 0.19, HZ + 0.025, caret.position);
      frameQ(0.19 / R, cx / R, caret.quaternion);
      caretMat.opacity = Math.sin(t * 5) > 0 ? 0.9 : 0;
    }

    // ---- spinner ----
    spinA -= dt * (3.2 + hov * 3 + (P >= 0 ? 10 * Math.sin(P * Math.PI) : 0)) * sp;
    spinner.rotation.z = spinA;

    // ---- video ilerleme ----
    playBoost = Math.max(0, playBoost - dt);
    playProg = (playProg + dt * (0.06 + playBoost * 0.25) * sp) % 1;
    bendPoint(-0.24 + 0.48 * playProg, -0.205, HZ + 0.012, playhead.position).applyQuaternion(qVid);

    // ---- düğmeler ----
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      let pr = b.press;
      if (P >= 0) {
        const lp = P * 3 - 0.3 - i * 0.25;
        if (lp > 0 && lp < 1) {
          pr = Math.max(pr, Math.sin(lp * Math.PI));
          b.lit = Math.max(b.lit, Math.sin(lp * Math.PI));
        }
      }
      b.mesh.position.copy(b.n).multiplyScalar(-0.045 * pr);
      b.lit = Math.max(0, b.lit - dt * 0.8);
      b.mat.emissiveIntensity = 0.08 + night * 0.25 + b.lit * 0.75 + hov * 0.08 * Math.max(0, Math.sin(t * 3 + i * 2));
      b.press = damp(b.press, 0, 10, dt);
    }

    // ---- şehir ışıkları ----
    for (let i = 0; i < beaconSpots.length; i++) {
      const tw = 0.6 + 0.4 * Math.sin(t * (2.1 + i * 0.7) + i * 2.3);
      const blink = i === beaconSpots.length - 1 ? (Math.sin(t * 4) > 0.3 ? 1.4 : 0.3) : tw;
      const sc = (0.7 + 0.5 * night + hov * 0.3) * blink;
      bm.compose(beaconSpots[i], q1.identity(), bs.setScalar(sc));
      beacons.setMatrixAt(i, bm);
    }
    beacons.instanceMatrix.needsUpdate = true;
    beaconMat.opacity = 0.55 + night * 0.4;
    for (let i = 0; i < NB; i++) {
      const pop = 1 + 0.14 * Math.max(0, Math.sin(t * 1.6 * sp - i * 0.9)) * (0.4 + hov);
      m1.copy(iconBase[i]).multiply(mz.makeScale(pop, pop, 1));
      iconMesh.setMatrixAt(i, m1);
      const lv = 0.85 + 0.15 * Math.sin(t * 2 + i) + night * 0.4;
      iconMesh.setColorAt(i, col.setRGB(lv, lv, lv * 0.96));
    }
    iconMesh.instanceMatrix.needsUpdate = true;
    if (iconMesh.instanceColor) iconMesh.instanceColor.needsUpdate = true;
    houseMat.emissiveIntensity = 0.12 + night * 0.4;

    // ---- imleç yörüngesi ve tıklama dalışı ----
    const w = (0.85 + hov * 0.6) * sp * (P >= 0 ? 2.2 : 1);
    th += dt * w * (diving >= 0 ? 0.25 : 1);
    const rel = th - thFront + 0.12;
    const lap = Math.floor(rel / TAU);
    if (lap !== lastLap) {
      lastLap = lap;
      if (diving < 0 && !s.reduce && P < 0) {
        diving = 0;
        clicked = false;
        target = order[orderI++ % order.length];
      }
    }
    orbitPos(th, v1);
    // yörünge yönelimi: dışa ve öne bakar, ucu gezegene döner
    v2.copy(v1)
      .normalize()
      .multiplyScalar(0.55)
      .add(v3.set(0, 0.1, 0.9))
      .normalize();
    v3.copy(v1).multiplyScalar(-1);
    v3.addScaledVector(v2, -v3.dot(v2)).normalize();
    vB.crossVectors(v2, v3);
    m1.makeBasis(v3, vB, v2).multiply(mLocalT);
    q1.setFromRotationMatrix(m1);
    let k = 0;
    let press = 0;
    if (diving >= 0) {
      diving += dt / DIVE;
      if (diving >= 1) diving = -1;
    }
    const b = btns[target];
    if (diving >= 0) {
      const d = diving;
      k = smooth(0, 0.33, d) - smooth(0.62, 1, d);
      press = Math.sin(smooth(0.38, 0.56, d) * Math.PI);
      if (!clicked && d > 0.47) {
        clicked = true;
        b.lit = 1;
        rippleT = 0;
        if (target === 2) playBoost = 2.5;
      }
      b.press = Math.max(b.press, press);
      v2.copy(b.tip).addScaledVector(b.n, 0.03 + 0.06 * (1 - press) - 0.045 * press);
      v3.copy(b.tip).addScaledVector(b.n, 0.75);
      cursor.position
        .copy(v1)
        .multiplyScalar((1 - k) * (1 - k))
        .addScaledVector(v3, 2 * k * (1 - k))
        .addScaledVector(v2, k * k);
      cursor.quaternion.copy(q1).slerp(b.q, smooth(0.1, 0.9, k));
    } else {
      cursor.position.copy(v1);
      cursor.quaternion.copy(q1);
    }
    cursor.position.y += 0.04 * Math.sin(t * 2.2) * (1 - k);
    if (P >= 0) curSpin = Math.sin(P * Math.PI) * TAU * ease.out(Math.min(1, P * 1.5));
    else curSpin = damp(curSpin, 0, 5, dt);
    curInner.rotation.set(-0.35 * press, 0, curSpin + 0.08 * Math.sin(t * 1.7) * (1 - k));
    curInner.scale.setScalar(1 - 0.1 * press);
    trailTex.offset.x = 1 - ((((th / TAU) % 1) + 1) % 1);
    trailMat.opacity = 0.55 + night * 0.35 + hov * 0.2;

    // tık dalgası
    if (rippleT >= 0) {
      rippleT += dt / 0.7;
      if (rippleT >= 1) rippleT = -1;
    }
    if (rippleT >= 0) {
      ripple.visible = true;
      ripple.position.copy(b.tip).addScaledVector(b.n, 0.01);
      ripple.quaternion.copy(b.q);
      ripple.scale.setScalar(0.8 + rippleT * 2.6);
      rippleMat.opacity = (1 - rippleT) * 0.9;
    } else ripple.visible = false;

    // ---- konfeti ----
    if (P >= 0) {
      confMesh.visible = true;
      s.camera.getWorldQuaternion(camQ);
      body.getWorldQuaternion(parentQ).invert().multiply(camQ);
      for (let i = 0; i < NC; i++) {
        const c = conf[i];
        const lp = Math.min(1, Math.max(0, (P - c.delay) / 0.75));
        const reach = 1.82 - c.o.length();
        v1.copy(c.o).addScaledVector(c.d, reach * ease.out(lp));
        v1.y -= 0.25 * lp * lp;
        const sc = c.s * (lp <= 0 ? 0 : Math.min(1, lp * 6)) * (1 - smooth(0.7, 1, lp));
        q2.setFromAxisAngle(lZ, c.spin * lp);
        q1.copy(parentQ).multiply(q2);
        bm.compose(v1, q1, bs.setScalar(Math.max(1e-4, sc)));
        confMesh.setMatrixAt(i, bm);
      }
      confMesh.instanceMatrix.needsUpdate = true;
    } else confMesh.visible = false;
  }

  return { group, update, poke };
}
