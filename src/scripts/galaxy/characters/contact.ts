import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
  tube,
  type Character,
  type CharacterState,
} from './kit';

/**
 * "Bana ulaşın": yuvarlak, retro bir posta kutusu; kendi minik gezegeninin üstünde bir direğe oturur.
 * Kağıt uçaklar yörüngede döner, arada biri ayrılıp kapıdaki mektup yarığından içeri dalar
 * (kapak kalkar, bayrak kalkar, kutu "yutkunur", lamba yanıp söner). Sohbet baloncukları yükselir.
 * Dürtünce kapak açılır, mektuplar ve uçaklar fışkırır, bir tur atıp geri döner.
 */

// Posta kutusu ölçüleri (kutu yerel uzayı: x boyuna, kapı +x ucunda, taban y=0)
const L = 1.5;
const W = 1.0;
const HB = 0.5;
const MY = -0.05; // kutunun iç gruptaki tabanı
const SLOT_X = 0.13;
const SLOT_Y = 0.66;

function archShape(w: number, hb: number, y0: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, y0);
  s.lineTo(w / 2, y0);
  s.lineTo(w / 2, hb);
  s.absarc(0, hb, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, y0);
  return s;
}

function stdMat(o: THREE.MeshStandardMaterialParameters) {
  return new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, bumpMap: clayBump(), bumpScale: 0.4, ...o });
}

/** Kağıt uçak: burun +z, kanatlar hafif yukarı, altta omurga. */
function planeGeometry() {
  const N = [0, 0, 0.17];
  const C = [0, 0.004, -0.13];
  const K = [0, -0.05, -0.12];
  const WL = [-0.12, 0.03, -0.15];
  const WR = [0.12, 0.03, -0.15];
  const ML = [-0.035, 0.012, -0.13];
  const MR = [0.035, 0.012, -0.13];
  const tris = [N, ML, WL, N, C, ML, N, WR, MR, N, MR, C, N, K, C];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  g.computeVertexNormals();
  return g;
}

function roundRect(x: CanvasRenderingContext2D, a: number, b: number, w: number, h: number, r: number) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

function heart(x: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  x.beginPath();
  x.moveTo(cx, cy + s * 0.9);
  x.bezierCurveTo(cx - s * 1.4, cy, cx - s * 0.9, cy - s * 1.0, cx, cy - s * 0.35);
  x.bezierCurveTo(cx + s * 0.9, cy - s * 1.0, cx + s * 1.4, cy, cx, cy + s * 0.9);
  x.closePath();
}

function envelopeIcon(x: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, stroke: string) {
  roundRect(x, cx - w / 2, cy - h / 2, w, h, h * 0.12);
  x.fillStyle = PAL.white;
  x.fill();
  x.lineWidth = h * 0.08;
  x.strokeStyle = stroke;
  x.stroke();
  x.beginPath();
  x.moveTo(cx - w / 2 + h * 0.08, cy - h / 2 + h * 0.1);
  x.lineTo(cx, cy + h * 0.08);
  x.lineTo(cx + w / 2 - h * 0.08, cy - h / 2 + h * 0.1);
  x.stroke();
}

const FONT = '"Arial Rounded MT Bold", "Nunito", "Trebuchet MS", system-ui, sans-serif';

export default function create(): Character {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = -0.72;
  group.add(inner);

  // ---------- Malzemeler ----------
  const mBody = clay(PAL.sky);
  const mCream = clay(PAL.cream, { emissive: 0.16 });
  const mButter = clay(PAL.butter, { rough: 0.6 });
  const mDoor = clay('#FFF7EA', { emissive: 0.3 });
  const mCoral = clay(PAL.coral);
  const mPlanet = clay(PAL.lilac);
  const mCrater = clay('#9C84E0');
  const mRing = clay(PAL.mint);
  const mPost = clay(PAL.cream);
  const mPaper = clay(PAL.white, { side: THREE.DoubleSide });
  const mTrail = clay(PAL.white, { opacity: 0.55 });

  const mSlot = stdMat({ color: '#3a2440', emissive: '#FFC86B', emissiveIntensity: 0 });
  const insideTex = canvasTexture(256, 256, (x, w, h) => {
    x.fillStyle = '#1F1538';
    x.fillRect(0, 0, w, h);
    const g = x.createRadialGradient(w / 2, h * 0.62, 10, w / 2, h * 0.62, w * 0.62);
    g.addColorStop(0, 'rgba(255,190,120,0.75)');
    g.addColorStop(0.35, 'rgba(214,120,150,0.35)');
    g.addColorStop(1, 'rgba(60,40,120,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    const e = x.createLinearGradient(0, 0, 0, h * 0.35);
    e.addColorStop(0, 'rgba(15,8,30,0.8)');
    e.addColorStop(1, 'rgba(15,8,30,0)');
    x.fillStyle = e;
    x.fillRect(0, 0, w, h);
  });
  const mInside = new THREE.MeshBasicMaterial({ map: insideTex });
  const mLamp = stdMat({ color: '#FFE08A', emissive: '#FFC94D', emissiveIntensity: 0.4, roughness: 0.4 });
  const mDiver = stdMat({ color: PAL.coral, side: THREE.DoubleSide, bumpMap: null });

  // ---------- Dokular ----------
  const labelTex = canvasTexture(1024, 320, (x, w, h) => {
    const text = 'ZERO POST';
    const cols = [PAL.coral, PAL.butter, PAL.pink, PAL.mint, '', PAL.periwinkle, PAL.apricot, PAL.leaf, PAL.lilac];
    x.font = `900 138px ${FONT}`;
    x.textBaseline = 'middle';
    let total = 0;
    const ws: number[] = [];
    for (const ch of text) {
      const m = ch === ' ' ? 36 : x.measureText(ch).width + 4;
      ws.push(m);
      total += m;
    }
    let cx = (w - 170 - total) / 2 + 10;
    [...text].forEach((ch, i) => {
      if (ch !== ' ') {
        const y = h / 2 + Math.sin(i * 1.7) * 10;
        x.save();
        x.translate(cx + ws[i] / 2, y);
        x.rotate(Math.sin(i * 2.3) * 0.08);
        x.lineJoin = 'round';
        x.lineWidth = 30;
        x.strokeStyle = PAL.white;
        x.strokeText(ch, -ws[i] / 2, 6);
        x.fillStyle = cols[i];
        x.fillText(ch, -ws[i] / 2, 6);
        x.fillStyle = 'rgba(255,255,255,0.45)';
        x.beginPath();
        x.ellipse(-ws[i] * 0.12, -36, 12, 7, -0.5, 0, Math.PI * 2);
        x.fill();
        x.restore();
      }
      cx += ws[i];
    });
    // küçük posta pulu
    const sx = w - 150;
    const sy = h / 2 - 70;
    x.fillStyle = PAL.white;
    for (let i = 0; i < 9; i++) {
      x.beginPath();
      x.arc(sx + i * 13.7, sy, 7, 0, Math.PI * 2);
      x.arc(sx + i * 13.7, sy + 140, 7, 0, Math.PI * 2);
      x.arc(sx, sy + i * 17.5, 7, 0, Math.PI * 2);
      x.arc(sx + 110, sy + i * 17.5, 7, 0, Math.PI * 2);
      x.fill();
    }
    x.fillRect(sx, sy, 110, 140);
    x.fillStyle = PAL.coral;
    x.fillRect(sx + 12, sy + 12, 86, 116);
    x.fillStyle = PAL.cream;
    heart(x, sx + 55, sy + 62, 26);
    x.fill();
    x.font = `900 22px ${FONT}`;
    x.textAlign = 'center';
    x.fillText('0', sx + 55, sy + 112);
  });

  const emblemTex = canvasTexture(256, 256, (x, w) => {
    x.fillStyle = '#FFE7B8';
    x.beginPath();
    x.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2);
    x.fill();
    x.lineWidth = 10;
    x.strokeStyle = PAL.apricot;
    x.beginPath();
    x.arc(w / 2, w / 2, w / 2 - 14, 0, Math.PI * 2);
    x.stroke();
    envelopeIcon(x, w / 2, w / 2 - 6, 130, 88, PAL.periwinkle);
    x.fillStyle = PAL.coral;
    heart(x, w / 2, w / 2 + 14, 16);
    x.fill();
    x.fillStyle = PAL.ink;
    x.font = `900 30px ${FONT}`;
    x.textAlign = 'center';
    x.fillText('No. 0', w / 2, w / 2 + 82);
  });

  const envTex = canvasTexture(256, 170, (x, w, h) => {
    x.fillStyle = '#FFFDF8';
    x.fillRect(0, 0, w, h);
    // hava postası kenar şeritleri
    for (let i = -2; i < 30; i++) {
      x.fillStyle = i % 2 ? PAL.coral : PAL.sky;
      for (const [a, b] of [
        [i * 18, 0],
        [i * 18, h - 10],
      ]) {
        x.save();
        x.translate(a, b);
        x.transform(1, 0, -0.6, 1, 0, 0);
        x.fillRect(0, 0, 10, 10);
        x.restore();
      }
    }
    x.strokeStyle = 'rgba(62,31,56,0.35)';
    x.lineWidth = 4;
    x.beginPath();
    x.moveTo(8, 14);
    x.lineTo(w / 2, h * 0.58);
    x.lineTo(w - 8, 14);
    x.stroke();
    x.fillStyle = PAL.coral;
    heart(x, w / 2, h * 0.58, 16);
    x.fill();
    x.fillStyle = PAL.butter;
    x.fillRect(w - 58, 20, 40, 48);
    x.fillStyle = 'rgba(62,31,56,0.3)';
    for (let i = 0; i < 3; i++) x.fillRect(24, 100 + i * 14, 80 - i * 18, 5);
  });

  function bubbleTex(kind: 0 | 1 | 2) {
    return canvasTexture(256, 256, (x) => {
      const cx = 128;
      const cy = 128;
      if (kind === 0) {
        x.fillStyle = PAL.periwinkle;
        for (let i = -1; i <= 1; i++) {
          x.beginPath();
          x.arc(cx + i * 46, cy, 17, 0, Math.PI * 2);
          x.fill();
        }
      } else if (kind === 1) {
        x.fillStyle = PAL.coral;
        heart(x, cx, cy + 6, 50);
        x.fill();
        x.fillStyle = 'rgba(255,255,255,0.6)';
        x.beginPath();
        x.ellipse(cx - 30, cy - 18, 11, 7, -0.6, 0, Math.PI * 2);
        x.fill();
      } else {
        // el sallayan el
        x.save();
        x.translate(cx + 4, cy + 10);
        x.rotate(-0.35);
        x.fillStyle = PAL.butter;
        x.strokeStyle = PAL.apricot;
        x.lineWidth = 5;
        const fingers = [
          [-30, -58, 0.0],
          [-10, -66, 0.0],
          [10, -62, 0.0],
          [28, -48, 0.15],
        ];
        for (const [fx, fy, fr] of fingers) {
          x.save();
          x.translate(fx, 0);
          x.rotate(fr);
          roundRect(x, -9, fy, 18, -fy + 4, 9);
          x.fill();
          x.stroke();
          x.restore();
        }
        x.save();
        x.translate(-38, 2);
        x.rotate(-0.9);
        roundRect(x, -9, -40, 18, 44, 9);
        x.fill();
        x.stroke();
        x.restore();
        roundRect(x, -40, -14, 78, 58, 24);
        x.fill();
        x.stroke();
        x.fillStyle = PAL.butter;
        x.fillRect(-36, -12, 70, 20);
        x.restore();
        x.strokeStyle = PAL.sky;
        x.lineWidth = 7;
        x.lineCap = 'round';
        for (const s of [-1, 1]) {
          x.beginPath();
          x.arc(cx + 4, cy + 4, 70, s > 0 ? -0.9 : Math.PI - 0.3, s > 0 ? -0.3 : Math.PI + 0.3);
          x.stroke();
        }
      }
    });
  }

  // ---------- Minik gezegen + direk ----------
  const PY = -0.74;
  const PR = 0.45;
  const planetG = new THREE.Group();
  planetG.position.y = PY;
  inner.add(planetG);
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 40, 28), mPlanet);
  planet.scale.set(1, 0.92, 1);
  planetG.add(planet);
  const craterGeo = new THREE.TorusGeometry(1, 0.3, 6, 16);
  const craters = new THREE.InstancedMesh(craterGeo, mCrater, 9);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const n = new THREE.Vector3();
    const z = new THREE.Vector3(0, 0, 1);
    const dirs = [
      [0.6, -0.2, 0.7, 0.08],
      [0.2, -0.6, 0.75, 0.06],
      [-0.5, -0.1, 0.8, 0.07],
      [0.85, 0.2, 0.2, 0.05],
      [-0.2, -0.85, 0.3, 0.06],
      [-0.8, 0.15, -0.4, 0.07],
      [0.3, -0.3, -0.9, 0.08],
      [0.7, -0.6, -0.2, 0.05],
      [-0.5, -0.6, -0.5, 0.06],
    ];
    dirs.forEach(([a, b, c, s], i) => {
      n.set(a, b, c).normalize();
      q.setFromUnitVectors(z, n);
      const p = n.clone().multiplyScalar(PR * 0.97);
      p.y *= 0.92;
      m.compose(p, q, new THREE.Vector3(s, s, s * 0.8));
      craters.setMatrixAt(i, m);
    });
  }
  planetG.add(craters);
  const ringGeo = new THREE.TorusGeometry(0.7, 0.032, 8, 64);
  ringGeo.scale(1, 1, 0.35);
  ringGeo.rotateX(Math.PI / 2);
  const ring = new THREE.Mesh(ringGeo, mRing);
  ring.rotation.set(0.32, 0, -0.18);
  planetG.add(ring);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.085, 0.34, 18), mPost);
  post.position.y = -0.2;
  inner.add(post);
  const postFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.06, 20), mButter);
  postFoot.position.y = PY + PR * 0.9 + 0.005;
  inner.add(postFoot);

  // ---------- Posta kutusu ----------
  const box = new THREE.Group();
  box.position.y = MY;
  inner.add(box);

  const bodyGeo = new THREE.ExtrudeGeometry(archShape(W - 0.12, HB, 0.06), {
    depth: L - 0.12,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 32,
  });
  bodyGeo.rotateY(Math.PI / 2);
  bodyGeo.translate(-(L - 0.12) / 2, 0, 0);
  box.add(new THREE.Mesh(bodyGeo, mBody));

  const trim = new THREE.Mesh(rbox(L + 0.08, 0.08, W + 0.08, 0.035), mCream);
  trim.position.y = 0.01;
  box.add(trim);

  // gövdeyi saran iki şerit + perçinler
  {
    const ribs: THREE.BufferGeometry[] = [];
    const rr = W / 2 + 0.005;
    for (const rx of [-0.56, 0.5]) {
      const pts: THREE.Vector3[] = [new THREE.Vector3(rx, 0.06, -rr), new THREE.Vector3(rx, HB * 0.5, -rr)];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI - (i / 16) * Math.PI;
        pts.push(new THREE.Vector3(rx, HB + Math.sin(a) * rr, Math.cos(a) * rr));
      }
      pts.push(new THREE.Vector3(rx, HB * 0.5, rr), new THREE.Vector3(rx, 0.06, rr));
      ribs.push(tube(pts, 0.03, 80, 8));
    }
    box.add(new THREE.Mesh(mergeGeometries(ribs), mCream));
    const riv = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), mButter, 18);
    const m = new THREE.Matrix4();
    let k = 0;
    for (const rx of [-0.56, 0.5]) {
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.06 + (i / 8) * 0.88);
        const r2 = rr + 0.028;
        m.makeTranslation(rx, HB + Math.sin(a) * r2, Math.cos(a) * r2);
        riv.setMatrixAt(k++, m);
      }
    }
    box.add(riv);
  }

  // yan etiketler (iki yanda)
  {
    const p1 = new THREE.PlaneGeometry(0.98, 0.306);
    p1.translate(-0.03, 0.29, W / 2 + 0.004);
    const p2 = new THREE.PlaneGeometry(0.98, 0.306);
    p2.rotateY(Math.PI);
    p2.translate(0.03, 0.29, -W / 2 - 0.004);
    const lab = new THREE.Mesh(
      mergeGeometries([p1, p2]),
      new THREE.MeshStandardMaterial({ map: labelTex, transparent: true, alphaTest: 0.4, roughness: 0.75 }),
    );
    box.add(lab);
  }

  // hava postası şeritleri (alt kenarda) + çatıdaki çıkartmalar: tek doku atlası, tek çizim
  {
    const AW = 512;
    const AH = 256;
    const atlas = canvasTexture(AW, AH, (x) => {
      x.fillStyle = PAL.white;
      x.fillRect(0, 0, AW, 24);
      for (let i = -2; i < 44; i++) {
        x.fillStyle = i % 2 ? PAL.coral : PAL.periwinkle;
        x.beginPath();
        x.moveTo(i * 12, 24);
        x.lineTo(i * 12 + 6, 24);
        x.lineTo(i * 12 + 14, 0);
        x.lineTo(i * 12 + 8, 0);
        x.closePath();
        x.fill();
      }
      const cell = (k: number, bg: string, draw: (cx: number, cy: number) => void) => {
        const cx = k * 128 + 64;
        const cy = 192;
        x.fillStyle = PAL.white;
        x.beginPath();
        x.arc(cx, cy, 62, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = bg;
        x.beginPath();
        x.arc(cx, cy, 52, 0, Math.PI * 2);
        x.fill();
        draw(cx, cy);
      };
      cell(0, PAL.butter, (cx, cy) => {
        x.fillStyle = PAL.white;
        x.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 ? 15 : 36;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        x.closePath();
        x.fill();
      });
      cell(1, PAL.pink, (cx, cy) => {
        x.fillStyle = PAL.white;
        heart(x, cx, cy + 4, 30);
        x.fill();
      });
      cell(2, PAL.mint, (cx, cy) => {
        x.fillStyle = PAL.white;
        x.font = `900 72px ${FONT}`;
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText('@', cx, cy + 4);
      });
      cell(3, PAL.lilac, (cx, cy) => {
        envelopeIcon(x, cx, cy, 62, 42, PAL.ink);
      });
    });
    const remap = (g: THREE.BufferGeometry, u0: number, v0: number, u1: number, v1: number) => {
      const uv = g.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
      return g;
    };
    const parts: THREE.BufferGeometry[] = [];
    for (const side of [1, -1]) {
      const g = remap(new THREE.PlaneGeometry(L - 0.16, 0.05), 0, 1 - 24 / AH, 1, 1);
      if (side < 0) g.rotateY(Math.PI);
      g.translate(0, 0.1, side * (W / 2 + 0.004));
      parts.push(g);
    }
    const rr = W / 2 + 0.006;
    const stick = [
      [-0.22, 1.05, 0, 0.075],
      [0.18, 1.5, 1, 0.07],
      [-0.05, 2.1, 2, 0.065],
      [0.22, 2.55, 3, 0.07],
      [-0.3, 0.55, 1, 0.06],
    ];
    const q = new THREE.Quaternion();
    const z = new THREE.Vector3(0, 0, 1);
    const n = new THREE.Vector3();
    const mm = new THREE.Matrix4();
    for (const [sx, a, k, r] of stick) {
      const g = remap(new THREE.CircleGeometry(r, 20), k * 0.25, 0, k * 0.25 + 0.25, 0.5);
      n.set(0, Math.sin(a), Math.cos(a));
      q.setFromUnitVectors(z, n);
      mm.compose(new THREE.Vector3(sx, HB + n.y * rr, n.z * rr), q, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(mm);
      parts.push(g);
    }
    box.add(
      new THREE.Mesh(
        mergeGeometries(parts),
        new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -2 }),
      ),
    );
  }

  // içerisi (kapak açılınca görünen sıcak, koyu oyuk)
  const insideGeo = new THREE.ShapeGeometry(archShape(W - 0.16, HB, 0.08), 24);
  insideGeo.rotateY(Math.PI / 2);
  {
    const pos = insideGeo.getAttribute('position');
    const uv = insideGeo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getZ(i) / W, pos.getY(i) / (HB + W / 2));
  }
  const inside = new THREE.Mesh(insideGeo, mInside);
  inside.position.x = L / 2 + 0.004;
  box.add(inside);

  // lamba ("postan var" ışığı) çatının arkasında
  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.14, 10), mCream);
  lampStem.position.set(-0.2, HB + W / 2 + 0.05, 0);
  box.add(lampStem);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), mLamp);
  lamp.position.set(-0.2, HB + W / 2 + 0.15, 0);
  box.add(lamp);
  const lampCap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), mCoral);
  lampCap.position.copy(lamp.position);
  lampCap.position.y += 0.012;
  box.add(lampCap);

  // bayrak (+z yanında, arkaya yakın)
  const flagPivot = new THREE.Group();
  flagPivot.position.set(-0.66, 0.3, W / 2 + 0.04);
  box.add(flagPivot);
  const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 16), mButter);
  bolt.rotation.x = Math.PI / 2;
  flagPivot.add(bolt);
  const arm = new THREE.Mesh(rbox(0.05, 0.56, 0.035, 0.017), mCoral);
  arm.position.set(0, 0.24, 0.035);
  flagPivot.add(arm);
  const flagPlate = new THREE.Mesh(rbox(0.26, 0.17, 0.035, 0.03), mCoral);
  flagPlate.position.set(-0.11, 0.44, 0.035);
  flagPivot.add(flagPlate);

  // kapak (+x ucunda, alt kenarından menteşeli)
  const door = new THREE.Group();
  door.position.set(L / 2 - 0.01, 0, 0);
  box.add(door);
  const doorGeo = new THREE.ExtrudeGeometry(archShape(W - 0.04, HB, 0.03), {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 3,
    curveSegments: 32,
  });
  doorGeo.rotateY(Math.PI / 2);
  doorGeo.translate(0.01, 0, 0);
  door.add(new THREE.Mesh(doorGeo, mDoor));
  // kapağın ön ve iç yüzünde gövdeyle aynı mavi çerçeve şeridi, içte perçinler ve bir çapraz kuşak
  {
    const rr = W / 2 - 0.035;
    const rim = (x: number) => {
      const pts: THREE.Vector3[] = [new THREE.Vector3(x, 0.07, -rr), new THREE.Vector3(x, HB * 0.6, -rr)];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI - (i / 16) * Math.PI;
        pts.push(new THREE.Vector3(x, HB + Math.sin(a) * rr, Math.cos(a) * rr));
      }
      pts.push(new THREE.Vector3(x, HB * 0.6, rr), new THREE.Vector3(x, 0.07, rr));
      return tube(pts, 0.024, 72, 8);
    };
    const brace = tube([new THREE.Vector3(-0.05, 0.5, -rr), new THREE.Vector3(-0.05, 0.5, rr)], 0.022, 4, 8);
    door.add(new THREE.Mesh(mergeGeometries([rim(0.115), rim(-0.045), brace]), mBody));
    const dr = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 8, 6), mButter, 12);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (0.04 + (i / 11) * 0.92);
      const r2 = rr - 0.06;
      m.makeTranslation(-0.05, HB + Math.sin(a) * r2 - (a < 0.3 || a > 2.85 ? 0.15 : 0), Math.cos(a) * r2);
      dr.setMatrixAt(i, m);
    }
    door.add(dr);
  }
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, W * 0.8, 12), mButter);
  hinge.rotation.x = Math.PI / 2;
  hinge.position.set(0.06, 0.02, 0);
  door.add(hinge);
  const slotFrame = new THREE.Mesh(rbox(0.04, 0.13, 0.48, 0.03), mButter);
  slotFrame.position.set(0.11, SLOT_Y, 0);
  door.add(slotFrame);
  const slot = new THREE.Mesh(rbox(0.03, 0.06, 0.39, 0.02), mSlot);
  slot.position.set(0.122, SLOT_Y, 0);
  door.add(slot);
  const flap = new THREE.Group();
  flap.position.set(0.15, SLOT_Y + 0.05, 0);
  door.add(flap);
  const flapPlate = new THREE.Mesh(rbox(0.022, 0.1, 0.42, 0.01), mButter);
  flapPlate.position.y = -0.05;
  flap.add(flapPlate);
  const flapNub = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), mCoral);
  flapNub.position.set(0.014, -0.085, 0);
  flap.add(flapNub);
  const emblemBase = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.03, 36), mButter);
  emblemBase.rotation.z = Math.PI / 2;
  emblemBase.position.set(0.11, 0.33, 0);
  door.add(emblemBase);
  const emblemGeo = new THREE.CircleGeometry(0.155, 36);
  emblemGeo.rotateY(Math.PI / 2);
  const emblem = new THREE.Mesh(emblemGeo, new THREE.MeshStandardMaterial({ map: emblemTex, roughness: 0.8 }));
  emblem.position.set(0.127, 0.33, 0);
  door.add(emblem);
  const latch = new THREE.Mesh(rbox(0.06, 0.08, 0.12, 0.025), mCoral);
  latch.position.set(0.11, 0.93, 0);
  door.add(latch);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), mButter);
  knob.position.set(0.15, 0.91, 0);
  door.add(knob);

  // ---------- Kağıt uçaklar ----------
  const planeGeo = planeGeometry();
  const ORB = 5;
  const BURST_P = 4;
  const planes = new THREE.InstancedMesh(planeGeo, mPaper, ORB + BURST_P);
  planes.frustumCulled = false;
  const planeCols = [PAL.coral, PAL.butter, PAL.mint, PAL.pink, PAL.lilac, PAL.apricot, PAL.white, PAL.leaf, PAL.sky];
  planeCols.forEach((c, i) => planes.setColorAt(i, new THREE.Color(c)));
  inner.add(planes);
  const ARC = 0.95;
  const GAP = 0.12;
  const trailGeo = new THREE.TorusGeometry(1, 0.008, 4, 28, ARC);
  trailGeo.rotateX(Math.PI / 2);
  const trails = new THREE.InstancedMesh(trailGeo, mTrail, ORB);
  trails.frustumCulled = false;
  inner.add(trails);
  const orbits = [
    { r: 1.52, tilt: new THREE.Euler(0.28, 0.0, 0.12), w: 0.55, th: 0.3 },
    { r: 1.62, tilt: new THREE.Euler(-0.22, 1.1, 0.3), w: 0.42, th: 2.2 },
    { r: 1.48, tilt: new THREE.Euler(0.4, 2.2, -0.15), w: 0.6, th: 4.1 },
    { r: 1.68, tilt: new THREE.Euler(-0.1, 3.0, -0.35), w: 0.38, th: 1.2 },
    { r: 1.56, tilt: new THREE.Euler(0.15, 4.4, 0.42), w: 0.5, th: 5.3 },
  ].map((o) => ({ ...o, q: new THREE.Quaternion().setFromEuler(o.tilt), vis: 1, hidden: false, back: 0 }));

  const diver = new THREE.Mesh(planeGeo, mDiver);
  diver.visible = false;
  diver.matrixAutoUpdate = false;
  inner.add(diver);

  // ---------- Mektuplar (dürtme) ----------
  const ENV = 7;
  const envGeo = new THREE.BoxGeometry(0.26, 0.17, 0.014);
  const envs = new THREE.InstancedMesh(envGeo, new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.85 }), ENV);
  envs.frustumCulled = false;
  inner.add(envs);
  // kutunun içinde dik duran mektup yığını (kapak kapalıyken kapağın içinde gizli kalır)
  {
    const stackGeo = new THREE.BoxGeometry(0.014, 0.17, 0.26);
    const stack = new THREE.InstancedMesh(stackGeo, envs.material, 5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 5; i++) {
      const sc = 1.25 + (i % 2) * 0.15;
      e.set((i - 2) * 0.09, 0, 0);
      q.setFromEuler(e);
      m.compose(
        new THREE.Vector3(L / 2 + 0.012 + i * 0.016, 0.07 + 0.085 * sc + (i % 3) * 0.02, (i - 2) * 0.05),
        q,
        new THREE.Vector3(1, sc, sc),
      );
      stack.setMatrixAt(i, m);
    }
    box.add(stack);
  }
  const burst = Array.from({ length: ENV + BURST_P }, (_, i) => {
    const az = -1.05 + ((i * 0.618) % 1) * 2.1;
    const el = -0.15 + ((i * 0.37 + 0.2) % 1) * 1.0;
    return {
      d: new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)),
      reach: 0.6 + ((i * 0.53) % 1) * 0.25,
      swirl: (i % 2 ? 1 : -1) * (0.25 + ((i * 0.29) % 1) * 0.2),
      start: 0.3 + i * 0.045,
      spin: 3 + (i % 3) * 2,
    };
  });

  // ---------- Sohbet baloncukları ----------
  const pillGeo = (() => {
    const w = 1.0;
    const h = 0.66;
    const r = 0.3;
    const p = new THREE.Shape();
    p.moveTo(-w / 2 + r, -h / 2);
    p.lineTo(w / 2 - r, -h / 2);
    p.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false);
    p.lineTo(w / 2, h / 2 - r);
    p.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false);
    p.lineTo(-w / 2 + r, h / 2);
    p.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false);
    p.lineTo(-w / 2, -h / 2 + r);
    p.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false);
    const tail = new THREE.Shape();
    tail.moveTo(-0.3, -0.2);
    tail.lineTo(-0.44, -0.56);
    tail.lineTo(-0.04, -0.3);
    tail.lineTo(-0.3, -0.2);
    const g = new THREE.ExtrudeGeometry([p, tail], {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.05);
    return g;
  })();
  const iconGeo = new THREE.PlaneGeometry(0.62, 0.62);
  const mPill = clay(PAL.white, { emissive: 0.2 });
  const bubbles = ([0, 1, 2] as const).map((k) => {
    const sp = new THREE.Group();
    sp.add(new THREE.Mesh(pillGeo, mPill));
    const im = new THREE.MeshBasicMaterial({ map: bubbleTex(k), transparent: true, depthWrite: false });
    const icon = new THREE.Mesh(iconGeo, im);
    icon.position.z = 0.106;
    sp.add(icon);
    sp.visible = false;
    group.add(sp);
    return { sp, im, u: -1, x0: 0, dir: 1 };
  });
  const QW = new THREE.Quaternion();

  // ---------- Geçici nesneler ----------
  const M = new THREE.Matrix4();
  const Q = new THREE.Quaternion();
  const Q2 = new THREE.Quaternion();
  const S = new THREE.Vector3();
  const P = new THREE.Vector3();
  const F = new THREE.Vector3();
  const U = new THREE.Vector3();
  const A = new THREE.Vector3();
  const B = new THREE.Vector3();
  const C = new THREE.Vector3();
  const D = new THREE.Vector3();
  const N = new THREE.Vector3();
  const O = new THREE.Vector3();
  const SIDE = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const YAX = new THREE.Vector3(0, 1, 0);
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const E = new THREE.Euler();
  const vx = new THREE.Vector3();
  const vy = new THREE.Vector3();
  const vz = new THREE.Vector3();
  const vt = new THREE.Vector3();

  function orient(
    m: THREE.Matrix4,
    pos: THREE.Vector3,
    fwd: THREE.Vector3,
    up: THREE.Vector3,
    roll: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    vz.copy(fwd).normalize();
    vx.crossVectors(up, vz);
    if (vx.lengthSq() < 1e-8) vx.set(1, 0, 0);
    vx.normalize();
    vy.crossVectors(vz, vx);
    if (roll !== 0) {
      const c = Math.cos(roll);
      const s = Math.sin(roll);
      vt.copy(vx).multiplyScalar(c).addScaledVector(vy, s);
      vy.multiplyScalar(c).addScaledVector(vx, -s);
      vx.copy(vt);
    }
    m.makeBasis(vx.multiplyScalar(sx), vy.multiplyScalar(sy), vz.multiplyScalar(sz));
    m.setPosition(pos);
  }

  function orbitPos(i: number, th: number, out: THREE.Vector3, fwd: THREE.Vector3, bob: number) {
    const o = orbits[i];
    out.set(Math.cos(th) * o.r, bob, Math.sin(th) * o.r).applyQuaternion(o.q);
    fwd.set(-Math.sin(th), 0, Math.cos(th)).applyQuaternion(o.q);
  }

  // kapıdaki yarığın iç gruptaki konumu ve dışa bakan normali
  function slotPose(out: THREE.Vector3, n: THREE.Vector3, sy: number) {
    const a = door.rotation.z;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const bx = L / 2 - 0.01;
    out.set(bx + SLOT_X * ca - SLOT_Y * sa, MY + (SLOT_X * sa + SLOT_Y * ca) * sy, 0);
    n.set(ca, sa, 0);
  }

  function burstAt(b: (typeof burst)[number], uu: number, out: THREE.Vector3) {
    const s1 = Math.sin(Math.PI * uu);
    return out
      .copy(O)
      .addScaledVector(b.d, b.reach * s1)
      .addScaledVector(UP, 0.3 * s1 * s1)
      .addScaledVector(SIDE, b.swirl * Math.sin(2 * Math.PI * uu));
  }

  function bezier(t: number, out: THREE.Vector3) {
    const it = 1 - t;
    out
      .copy(A)
      .multiplyScalar(it * it * it)
      .addScaledVector(B, 3 * it * it * t)
      .addScaledVector(C, 3 * it * t * t)
      .addScaledVector(D, t * t * t);
    return out;
  }

  // ---------- Durum ----------
  const pokeAnim = new OneShot(3.0);
  let clock = 0;
  let diveT = -1;
  let diveK = 0;
  let nextDive = 1.6;
  let flag = 0;
  let flagHold = 0;
  let flapA = 0;
  let flapV = 0;
  let flapTarget = 0;
  let gulp = -1;
  let blink = 0;
  let nextBubble = 1.2;
  let bubbleIdx = 0;
  let ajar = 0;

  function spawnBubble(kind: number) {
    const b = bubbles[kind % 3];
    b.u = 0;
    b.dir = kind % 2 ? -1 : 1;
    b.x0 = -0.15 + (kind % 3) * 0.18;
  }

  function startDive() {
    // yarığa en yakın yörünge uçağını seç
    slotPose(O, N, 1);
    O.addScaledVector(N, 0.6);
    let best = -1;
    let bd = 1e9;
    for (let i = 0; i < ORB; i++) {
      if (orbits[i].hidden) continue;
      orbitPos(i, orbits[i].th, P, F, 0);
      const d = P.distanceToSquared(O) - F.dot(N) * 0.4;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    if (best < 0) return;
    diveK = best;
    const o = orbits[best];
    o.hidden = true;
    o.vis = 0;
    orbitPos(best, o.th, A, F, Math.sin(clock * 1.3 + best) * 0.05);
    B.copy(A).addScaledVector(F, 0.55);
    U.copy(A).normalize();
    B.addScaledVector(U, 0.25);
    mDiver.color.set(planeCols[best]);
    diveT = 0;
    diver.visible = true;
  }

  function onMail() {
    flapTarget = 0;
    flapV -= 6;
    gulp = 0;
    flagHold = 2.8;
    blink = 1.4;
    spawnBubble(1);
  }

  function update(s: CharacterState) {
    const dt = s.dt;
    const red = s.reduce;
    const hov = s.hover;
    const sp = red ? 0.25 : 1 + hov * 1.1;
    clock += dt;
    const t = clock;
    const pp = pokeAnim.tick(dt);
    const T = pp >= 0 ? pp * pokeAnim.dur : -1;

    // gövde: süzülme, hafif sallanma
    const bobA = red ? 0.015 : 0.05;
    inner.position.y = 0.13 + Math.sin(t * 1.1) * bobA;
    inner.rotation.z = Math.sin(t * 0.7) * (red ? 0.01 : 0.035);
    inner.rotation.x = Math.sin(t * 0.53 + 1) * (red ? 0.01 : 0.03);
    inner.rotation.y = -0.72 + Math.sin(t * 0.31) * (red ? 0.02 : 0.08);
    planetG.rotation.y += dt * 0.25 * sp;

    // yutkunma / dürtme esnemeleri
    let sqY = 1;
    let sqX = 1;
    if (gulp >= 0) {
      gulp += dt / 0.55;
      const g = gulp >= 1 ? 0 : Math.sin(gulp * Math.PI * 2) * (1 - gulp);
      sqY = 1 - g * 0.07;
      sqX = 1 + g * 0.05;
      if (gulp >= 1) gulp = -1;
    }
    if (T >= 0) {
      if (T < 0.25) {
        const k = Math.sin((T / 0.25) * Math.PI);
        sqY -= k * 0.09;
        sqX += k * 0.06;
      } else if (T < 0.8) {
        const k = Math.sin(((T - 0.25) / 0.55) * Math.PI) * Math.exp(-(T - 0.25) * 3);
        sqY += k * 0.1;
        sqX -= k * 0.05;
      }
      inner.rotation.z += T < 0.3 ? Math.sin(T * 60) * 0.03 * (1 - T / 0.3) : 0;
    }
    box.scale.set(sqX, sqY, sqX);

    // kapak
    ajar = damp(ajar, red ? 0 : hov * 0.24, 6, dt);
    let open = 0;
    if (T >= 0) {
      if (T < 0.15) open = 0;
      else if (T < 0.6) open = ease.outBack((T - 0.15) / 0.45);
      else if (T < 2.3) open = 1;
      else if (T < 2.72) open = 1 - ease.inOut((T - 2.3) / 0.42);
      else open = -Math.sin((T - 2.72) * 28) * 0.05 * Math.exp(-(T - 2.72) * 9);
    }
    door.rotation.z = -(open * 1.62 + ajar);
    mInside.color.setScalar(
      0.8 + s.night * 0.3 + Math.min(1, Math.max(0, open)) * 0.25 + ajar + Math.sin(t * 1.7) * 0.05,
    );

    // yörünge uçakları
    for (let i = 0; i < ORB; i++) {
      const o = orbits[i];
      o.th += o.w * dt * sp;
      if (!o.hidden) o.vis = damp(o.vis, 1, 5, dt);
      const bob = Math.sin(t * 1.3 + i) * 0.05;
      orbitPos(i, o.th, P, F, bob);
      U.set(0, 1, 0).applyQuaternion(o.q);
      const v = o.hidden ? 0 : ease.out(o.vis);
      if (v < 0.01) {
        planes.setMatrixAt(i, ZERO);
        trails.setMatrixAt(i, ZERO);
        continue;
      }
      orient(M, P, F, U, -0.35 + Math.sin(t * 2 + i * 1.7) * 0.15, v * 1.3, v * 1.3, v * 1.3);
      planes.setMatrixAt(i, M);
      Q2.setFromAxisAngle(YAX, ARC + GAP - o.th);
      Q.copy(o.q).multiply(Q2);
      A.set(0, bob, 0).applyQuaternion(o.q);
      S.setScalar(o.r * v);
      M.compose(A, Q, S);
      trails.setMatrixAt(i, M);
    }

    // dalış: bir uçak yarıktan içeri girer
    if (diveT < 0 && T < 0 && !red) {
      nextDive -= dt * (1 + hov * 0.8);
      if (nextDive <= 0) {
        startDive();
        nextDive = 5.2;
      }
    }
    if (diveT >= 0) {
      if (T >= 0) diveT = Math.max(diveT, 0.9);
      diveT += dt / 2.1;
      slotPose(O, N, box.scale.y);
      C.copy(O).addScaledVector(N, 0.62);
      D.copy(O).addScaledVector(N, -0.3);
      const u = Math.min(1, diveT);
      const e = u < 0.75 ? ease.inOut(u / 0.75) * 0.82 : 0.82 + ((u - 0.75) / 0.25) * 0.18;
      bezier(e, P);
      bezier(Math.min(1, e + 0.01), F);
      F.sub(P);
      if (F.lengthSq() < 1e-8) F.copy(N).negate();
      const fold = smooth(0.6, 0.85, u);
      orient(M, P, F, UP, (1 - fold) * Math.sin(u * 9) * 0.4, 1.3 - fold * 0.55, 1.3 - fold * 0.75, 1.3 - fold * 0.3);
      diver.matrix.copy(M);
      flapTarget = u > 0.7 && u < 0.97 ? 1.25 : 0;
      if (diveT >= 1) {
        diveT = -1;
        diver.visible = false;
        orbits[diveK].back = 1.4;
        onMail();
      }
    }
    for (let i = 0; i < ORB; i++) {
      const o = orbits[i];
      if (o.hidden && diveT < 0 && o.back > 0) {
        o.back -= dt;
        if (o.back <= 0) {
          o.hidden = false;
          o.vis = 0;
        }
      }
    }

    // kapak kanadı: yaylı
    flapV += (-(flapA - flapTarget) * 120 - flapV * 9) * dt;
    flapA += flapV * dt;
    if (flapA < -0.05) {
      flapA = -0.05;
      flapV *= -0.4;
    }
    flap.rotation.z = flapA + (T >= 0 && open > 0.5 ? Math.sin(t * 20) * 0.15 : 0);
    mSlot.emissiveIntensity = s.night * 0.8 + flapA * 0.5;

    // bayrak
    if (T > 0.3 && T < 2.8) flagHold = Math.max(flagHold, 0.1);
    flagHold -= dt;
    const flagT = flagHold > 0 ? 1 : 0;
    flag = damp(flag, flagT, flagT ? 9 : 3, dt);
    const flagWig = Math.sin(t * 3.1) * 0.04 + hov * Math.sin(t * 11) * 0.08;
    flagPivot.rotation.z = (1 - ease.outBack(Math.min(1, flag))) * 1.5 + flagWig;

    // lamba
    blink = Math.max(0, blink - dt);
    const bl = blink > 0 || T >= 0 ? (Math.sin(t * 22) > 0 ? 1 : 0.2) : 0;
    mLamp.emissiveIntensity = 0.35 + s.night * 0.9 + Math.sin(t * 2.4) * 0.1 + bl * 1.4 + hov * 0.4;

    // dürtme: mektuplar ve uçaklar fışkırır, tur atıp geri döner
    O.set(L / 2 + 0.06, MY + 0.45, 0);
    for (let i = 0; i < ENV + BURST_P; i++) {
      const b = burst[i];
      const isEnv = i < ENV;
      const u = T >= 0 ? (T - b.start) / 1.6 : -1;
      if (u <= 0 || u >= 1) {
        if (isEnv) envs.setMatrixAt(i, ZERO);
        else planes.setMatrixAt(ORB + i - ENV, ZERO);
        continue;
      }
      const sc = smooth(0, 0.12, u) * (1 - smooth(0.88, 1, u));
      SIDE.set(-b.d.z, 0, b.d.x).normalize();
      burstAt(b, u, P);
      if (isEnv) {
        E.set(u * b.spin + i, u * b.spin * 0.7, Math.sin(u * 6 + i) * 0.6);
        Q.setFromEuler(E);
        S.setScalar(sc);
        M.compose(P, Q, S);
        envs.setMatrixAt(i, M);
      } else {
        burstAt(b, Math.min(1, u + 0.01), F);
        F.sub(P);
        orient(M, P, F, UP, Math.sin(u * 8) * 0.5, sc * 1.2, sc * 1.2, sc * 1.2);
        planes.setMatrixAt(ORB + i - ENV, M);
      }
    }
    planes.instanceMatrix.needsUpdate = true;
    trails.instanceMatrix.needsUpdate = true;
    envs.instanceMatrix.needsUpdate = true;

    // baloncuklar
    if (!red) {
      nextBubble -= dt * (1 + hov * 1.5);
      if (nextBubble <= 0) {
        spawnBubble(bubbleIdx === 1 ? 2 : bubbleIdx);
        bubbleIdx = (bubbleIdx + 1) % 3;
        nextBubble = 2.6;
      }
      if (T >= 0.5 && T - dt < 0.5) spawnBubble(0);
      if (T >= 0.75 && T - dt < 0.75) spawnBubble(1);
      if (T >= 1.0 && T - dt < 1.0) spawnBubble(2);
    }
    for (const b of bubbles) {
      if (b.u < 0) {
        b.sp.visible = false;
        continue;
      }
      b.u += dt / 2.4;
      if (b.u >= 1) {
        b.u = -1;
        b.sp.visible = false;
        continue;
      }
      const u = b.u;
      b.sp.visible = true;
      const pop = ease.outElastic(Math.min(1, u * 3.5));
      const sc = 0.3 * pop * (1 - smooth(0.8, 1, u));
      b.sp.scale.setScalar(Math.max(0.001, sc));
      b.sp.position.set(b.x0 + b.dir * u * 0.35 + Math.sin(u * 7) * 0.04, 1.08 + ease.out(u) * 0.55, 0.35 + u * 0.2);
      b.im.opacity = 1 - smooth(0.75, 0.95, u);
      // kameraya dön, hafifçe sallan
      group.getWorldQuaternion(QW).invert().multiply(s.camera.quaternion);
      b.sp.quaternion.copy(QW);
      b.sp.rotateZ(Math.sin(u * 5 + b.dir) * 0.12);
      b.sp.rotateY(Math.sin(u * 4 + b.dir) * 0.25);
    }
  }

  return {
    group,
    update,
    poke() {
      if (pokeAnim.on && pokeAnim.p < 0.85) return;
      pokeAnim.start();
    },
  };
}
