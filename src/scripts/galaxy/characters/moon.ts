import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, clay, clayBump, damp, ease, OneShot, smooth, type Character } from './kit';

/**
 * Gece ayı: hilal gibi kıvrılıp uyuyan kedi.
 * Gövde: yumuşak birleşen kürelerden (SDF) oluşan tombul bir somun; kafa ön patilerin üstünde,
 * kuyruk gövdenin altından öne dolanır. Sırtında yıldızlı, kapitone lacivert bir battaniye,
 * başında örgü dokulu sarı bir gece külahı. Siluet: sağda dışbükey sırt, solda kafa ve kuyruk uçları (☾).
 */

// ---------- renkler ----------
const C = {
  fur: new THREE.Color('#5B60C9'),
  furDark: new THREE.Color('#3F3FA0'),
  furLight: new THREE.Color('#8A93EE'),
  furPale: new THREE.Color('#A9B0F7'),
  pink: '#F49BBE',
  ink: '#241C4A',
  lining: '#8C9AF4',
  gold: '#F5C452',
  silver: '#D6D2FA',
  cream: '#FFF6DE',
};

// ---------- küçük yardımcılar ----------
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
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
type Blob = [number, number, number, number, number, number]; // merkez xyz, yarıçap xyz
const sdBlob = (p: THREE.Vector3, b: Blob) => {
  const x = (p.x - b[0]) / b[3],
    y = (p.y - b[1]) / b[4],
    z = (p.z - b[2]) / b[5];
  return (Math.sqrt(x * x + y * y + z * z) - 1) * Math.min(b[3], b[4], b[5]);
};
function blobSdf(blobs: Blob[], k: number) {
  return (p: THREE.Vector3) => {
    let d = sdBlob(p, blobs[0]);
    for (let i = 1; i < blobs.length; i++) d = smin(d, sdBlob(p, blobs[i]), k);
    return d;
  };
}
/** Merkezden çıkan ışın boyunca yüzeyin yarıçapı (dıştan içe tarayıp ikiye bölerek). */
function radial(sdf: (p: THREE.Vector3) => number, c: THREE.Vector3, max = 2.2) {
  const p = new THREE.Vector3();
  return (dir: THREE.Vector3) => {
    let r = max;
    const step = 0.04;
    while (r > 0 && sdf(p.copy(dir).multiplyScalar(r).add(c)) > 0) r -= step;
    let lo = r,
      hi = r + step;
    for (let i = 0; i < 14; i++) {
      const m = (lo + hi) / 2;
      if (sdf(p.copy(dir).multiplyScalar(m).add(c)) > 0) hi = m;
      else lo = m;
    }
    return (lo + hi) / 2;
  };
}
function sdfNormal(sdf: (p: THREE.Vector3) => number, p: THREE.Vector3, out: THREE.Vector3) {
  const e = 0.004;
  const q = new THREE.Vector3();
  const f = (dx: number, dy: number, dz: number) => sdf(q.set(p.x + dx, p.y + dy, p.z + dz));
  return out.set(f(e, 0, 0) - f(-e, 0, 0), f(0, e, 0) - f(0, -e, 0), f(0, 0, e) - f(0, 0, -e)).normalize();
}
/** Küreyi SDF yüzeyine oturtan, dikişsiz normalli, vertex renkli geometri. */
function sdfMesh(
  sdf: (p: THREE.Vector3) => number,
  c: THREE.Vector3,
  ws: number,
  hs: number,
  color: (p: THREE.Vector3, out: THREE.Color) => void,
) {
  const R = radial(sdf, c);
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, ws, hs);
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = mergeVertices(g);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const d = new THREE.Vector3();
  const cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const r = R(d);
    d.multiplyScalar(r).add(c);
    pos.setXYZ(i, d.x, d.y, d.z);
    color(d, cc);
    col[i * 3] = cc.r;
    col[i * 3 + 1] = cc.g;
    col[i * 3 + 2] = cc.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return { geo: g, R };
}

function furMat() {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.84,
    metalness: 0,
    bumpMap: clayBump(),
    bumpScale: 0.6,
    emissive: '#2A2C78',
    emissiveIntensity: 0.25,
  });
}

/** Örgü (jarse ilmeği) dokusu: renk + bump. */
function knitTextures() {
  const draw = (bump: boolean) => (x: CanvasRenderingContext2D, w: number, h: number) => {
    x.fillStyle = bump ? '#303030' : '#D9A93A';
    x.fillRect(0, 0, w, h);
    const cols = 8,
      rows = 8;
    const cw = w / cols,
      rh = h / rows;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const cx = c * cw + cw / 2,
          cy = r * rh + rh / 2;
        for (const s of [-1, 1]) {
          x.save();
          x.translate(cx + s * cw * 0.22, cy);
          x.rotate(s * -0.55);
          const gr = x.createLinearGradient(0, -rh * 0.6, 0, rh * 0.6);
          if (bump) {
            gr.addColorStop(0, '#9A9A9A');
            gr.addColorStop(0.5, '#FFFFFF');
            gr.addColorStop(1, '#8A8A8A');
          } else {
            gr.addColorStop(0, '#F3C552');
            gr.addColorStop(0.45, '#FFE9A6');
            gr.addColorStop(1, '#E8B23E');
          }
          x.fillStyle = gr;
          x.beginPath();
          x.ellipse(0, 0, cw * 0.2, rh * 0.62, 0, 0, Math.PI * 2);
          x.fill();
          x.restore();
        }
      }
  };
  const map = canvasTexture(256, 256, draw(false));
  const bump = canvasTexture(256, 256, draw(true));
  bump.colorSpace = THREE.NoColorSpace;
  for (const t of [map, bump]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, bump };
}

/** Kapitone battaniye karosu: lacivert yastıkçık, dikiş çizgileri, minik altın noktalar. */
function quiltTexture() {
  const t = canvasTexture(256, 256, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, '#34479A');
    g.addColorStop(1, '#1B2560');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#6F80D8';
    x.lineWidth = 5;
    x.setLineDash([14, 10]);
    x.strokeRect(0, 0, w, h);
    x.setLineDash([]);
    const r = rng(7);
    for (let i = 0; i < 7; i++) {
      x.fillStyle = i % 3 === 0 ? '#C9C3F5' : '#F5C452';
      x.beginPath();
      x.arc(30 + r() * (w - 60), 30 + r() * (h - 60), 2.5 + r() * 2.5, 0, Math.PI * 2);
      x.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function starShape(R: number, r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r : R;
    if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}
function crescentShape(R: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, R, Math.PI * 0.25, Math.PI * 1.75, false);
  s.absarc(R * 0.45, 0, R * 0.78, Math.PI * 1.62, Math.PI * 0.38, true);
  s.closePath();
  return s;
}
const extrude = (s: THREE.Shape, depth: number) =>
  new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: depth * 0.6,
    bevelSize: depth * 0.6,
    bevelSegments: 2,
    curveSegments: 6,
  }).translate(0, 0, -depth / 2);

function zTexture() {
  return canvasTexture(64, 64, (x) => {
    x.font = 'bold 50px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.lineWidth = 8;
    x.strokeStyle = '#2B2A6B';
    x.strokeText('z', 32, 32);
    x.fillStyle = '#FFE08A';
    x.fillText('z', 32, 32);
  });
}
function glowTexture() {
  return canvasTexture(64, 64, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,240,190,1)');
    g.addColorStop(0.3, 'rgba(255,215,120,0.45)');
    g.addColorStop(1, 'rgba(255,200,100,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, w);
  });
}

export default function create(): Character {
  const group = new THREE.Group();
  const root = new THREE.Group(); // hafif sallanma ve hilal eğimi
  group.add(root);
  const m4 = new THREE.Matrix4();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const q1 = new THREE.Quaternion();

  // ================= GÖVDE =================
  const bodyBlobs: Blob[] = [
    [-0.04, 0.42, 0.02, 0.5, 0.44, 0.5], // göğüs / omuz
    [-0.3, 0.28, 0.14, 0.3, 0.3, 0.3], // boyun / göğüs önü
    [0.42, 0.02, -0.1, 0.56, 0.7, 0.6], // sırt
    [0.14, -0.52, 0.0, 0.6, 0.45, 0.58], // kalça
    [-0.2, -0.66, 0.1, 0.4, 0.3, 0.4], // arka bacak (uyluk)
  ];
  const bodySdf = blobSdf(bodyBlobs, 0.35);
  const bodyC = new THREE.Vector3(0.18, -0.05, -0.02);
  const body = sdfMesh(bodySdf, bodyC, 84, 60, (p, out) => {
    // açık göğüs/karın, sırtta koyu tekir çizgileri
    const belly = smooth(0.0, 0.5, -p.x * 0.7 + p.z * 0.8 - p.y * 0.2);
    out.copy(C.fur).lerp(C.furLight, belly * 0.9);
    const ang = Math.atan2(p.y - bodyC.y, p.x - bodyC.x);
    const stripe = smooth(0.55, 0.85, Math.sin(ang * 9 + p.z * 2)) * (1 - belly);
    out.lerp(C.furDark, stripe * 0.6);
  });
  const fur = furMat();
  const bodyG = new THREE.Group(); // nefes alır
  bodyG.position.copy(bodyC);
  root.add(bodyG);
  bodyG.add(new THREE.Mesh(body.geo.translate(-bodyC.x, -bodyC.y, -bodyC.z), fur));
  const bodyR = body.R;

  // ================= BATTANİYE =================
  const blanketG = new THREE.Group(); // kayınca döner (gövde merkezinde)
  bodyG.add(blanketG);
  const B = new THREE.Vector3(0.85, 0.22, 0.3).normalize();
  const T1 = new THREE.Vector3(0, 1, 0).cross(B).normalize();
  const T2 = new THREE.Vector3().crossVectors(B, T1).normalize();
  const aMax = (phi: number) => 1.5 + 0.13 * Math.sin(3 * phi + 0.6) + 0.06 * Math.sin(7 * phi + 1.3);
  const QK = 4.2; // kapitone hücre yoğunluğu
  const bDir = (a: number, phi: number, out: THREE.Vector3) =>
    out
      .copy(B)
      .multiplyScalar(Math.cos(a))
      .addScaledVector(T1, Math.sin(a) * Math.cos(phi))
      .addScaledVector(T2, Math.sin(a) * Math.sin(phi));
  const quilt = (a: number, phi: number) => {
    const u = a * Math.cos(phi),
      v = a * Math.sin(phi);
    return [(u + v) * QK * 0.5, (u - v) * QK * 0.5] as const;
  };
  const blanketLift = (a: number, phi: number) => {
    const [qa, qb] = quilt(a, phi);
    const puff = Math.pow(Math.abs(Math.sin(Math.PI * qa) * Math.sin(Math.PI * qb)), 0.6);
    const edge = smooth(0, 0.18, aMax(phi) - a);
    return 0.03 + (0.012 + 0.04 * puff) * edge;
  };
  {
    const NA = 30,
      NP = 100;
    const pos: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    const d = new THREE.Vector3();
    for (let i = 0; i <= NA; i++)
      for (let j = 0; j <= NP; j++) {
        const phi = (j / NP) * Math.PI * 2;
        const a = aMax(phi) * Math.pow(i / NA, 0.85);
        bDir(a, phi, d);
        const r = bodyR(d) + blanketLift(a, phi);
        pos.push(d.x * r, d.y * r, d.z * r);
        const [qa, qb] = quilt(a, phi);
        uv.push(qa, qb);
      }
    for (let i = 0; i < NA; i++)
      for (let j = 0; j < NP; j++) {
        const p0 = i * (NP + 1) + j,
          p1 = p0 + NP + 1;
        idx.push(p0, p1, p0 + 1, p1, p1 + 1, p0 + 1);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      map: quiltTexture(),
      roughness: 0.88,
      bumpMap: clayBump(),
      bumpScale: 0.4,
      side: THREE.DoubleSide,
      emissive: '#1A2466',
      emissiveIntensity: 0.25,
    });
    blanketG.add(new THREE.Mesh(g, mat));
    // açık mavi kenar şeridi (astar)
    const hem: THREE.Vector3[] = [];
    for (let j = 0; j < 90; j++) {
      const phi = (j / 90) * Math.PI * 2;
      const a = aMax(phi);
      bDir(a, phi, d);
      const r = bodyR(d) + 0.035;
      hem.push(d.clone().multiplyScalar(r));
    }
    blanketG.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hem, true), 200, 0.045, 8, true),
        clay(C.lining),
      ),
    );
  }
  // battaniyedeki kabartma yıldızlar ve hilaller
  const starGold = new THREE.MeshStandardMaterial({
    color: C.gold,
    roughness: 0.45,
    metalness: 0.25,
    emissive: C.gold,
    emissiveIntensity: 0.15,
  });
  const starSilver = new THREE.MeshStandardMaterial({
    color: C.silver,
    roughness: 0.5,
    metalness: 0.15,
    emissive: C.silver,
    emissiveIntensity: 0.12,
  });
  const decoSpots: { pos: THREE.Vector3; q: THREE.Quaternion; s: number; kind: number }[] = [];
  {
    const r = rng(11);
    const d = new THREE.Vector3(),
      n = new THREE.Vector3(),
      wp = new THREE.Vector3();
    let tries = 0;
    while (decoSpots.length < 22 && tries++ < 600) {
      const phi = r() * Math.PI * 2;
      const a = Math.sqrt(r()) * (aMax(phi) - 0.16);
      bDir(a, phi, d);
      const rr = bodyR(d);
      wp.copy(d).multiplyScalar(rr);
      if (decoSpots.some((s) => s.pos.distanceTo(wp) < 0.26)) continue;
      const pos = d.clone().multiplyScalar(rr + blanketLift(a, phi) + 0.002);
      sdfNormal(bodySdf, wp.clone().add(bodyC), n);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), r() * 6.28));
      const kind = decoSpots.length % 5 === 2 ? 2 : decoSpots.length % 3 === 1 ? 1 : 0;
      decoSpots.push({ pos, q, s: 0.75 + r() * 0.55, kind });
    }
  }
  const kinds = [
    { geo: extrude(starShape(0.085, 0.038), 0.02), mat: starGold },
    { geo: extrude(starShape(0.07, 0.031), 0.02), mat: starSilver },
    { geo: extrude(crescentShape(0.085), 0.02), mat: starGold },
  ];
  kinds.forEach((k, ki) => {
    const list = decoSpots.filter((s) => s.kind === ki);
    const im = new THREE.InstancedMesh(k.geo, k.mat, list.length);
    list.forEach((s, i) => im.setMatrixAt(i, m4.compose(s.pos, s.q, v1.setScalar(s.s))));
    blanketG.add(im);
  });
  // gece parıltıları
  const glows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({
      map: glowTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
    decoSpots.length,
  );
  const glowCol = new THREE.Color(0, 0, 0);
  decoSpots.forEach((s, i) => {
    v2.copy(s.pos).normalize().multiplyScalar(0.02).add(s.pos);
    glows.setMatrixAt(i, m4.compose(v2, s.q, v1.setScalar(s.s)));
    glows.setColorAt(i, glowCol);
  });
  glows.renderOrder = 2;
  blanketG.add(glows);

  // ================= KUYRUK =================
  const tailMat = furMat();
  const tailPts = [
    new THREE.Vector3(0.62, -0.66, -0.3),
    new THREE.Vector3(0.42, -0.98, 0.05),
    new THREE.Vector3(-0.08, -1.04, 0.34),
    new THREE.Vector3(-0.6, -0.92, 0.44),
    new THREE.Vector3(-0.98, -0.66, 0.4),
  ];
  const tipPts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.16, 0.16, -0.02),
    new THREE.Vector3(-0.24, 0.36, -0.05),
    new THREE.Vector3(-0.2, 0.54, -0.08),
  ];
  const tailGeo = (pts: THREE.Vector3[], r0: number, r1: number, tipLight: boolean) => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const seg = 32,
      rad = 12;
    const g = new THREE.TubeGeometry(curve, seg, 1, rad, false);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const cc = new THREE.Color();
    const pt = new THREE.Vector3();
    for (let i = 0; i <= seg; i++) {
      const u = i / seg;
      curve.getPointAt(u, pt);
      // uca doğru kabarık, en uçta yuvarlak kapanış
      let r = r0 + (r1 - r0) * u;
      if (tipLight) r *= Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (u - 0.75) / 0.25), 2))) * 0.98 + 0.02;
      for (let j = 0; j <= rad; j++) {
        const k = i * (rad + 1) + j;
        v1.fromBufferAttribute(pos, k).sub(pt);
        const fluff = 1;
        v1.multiplyScalar(r * fluff).add(pt);
        pos.setXYZ(k, v1.x, v1.y, v1.z);
        const band = tipLight ? smooth(0.45, 0.7, u) : smooth(0.6, 0.85, Math.sin(u * 14)) * (1 - smooth(0.8, 0.92, u));
        if (tipLight) cc.copy(C.fur).lerp(C.furPale, band);
        else cc.copy(C.fur).lerp(C.furDark, band * 0.7);
        col[k * 3] = cc.r;
        col[k * 3 + 1] = cc.g;
        col[k * 3 + 2] = cc.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  };
  bodyG.add(new THREE.Mesh(tailGeo(tailPts, 0.17, 0.15, false).translate(-bodyC.x, -bodyC.y, -bodyC.z), tailMat));
  const tipPivot = new THREE.Group();
  tipPivot.position.copy(tailPts[tailPts.length - 1]).sub(bodyC);
  bodyG.add(tipPivot);
  tipPivot.add(new THREE.Mesh(tailGeo(tipPts, 0.15, 0.17, true), tailMat));
  tipPivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.152, 16, 12), clay(C.fur)));

  // patiler: kapsül + üç parmak
  const pawGeo = (len: number, r: number) => {
    const parts: THREE.BufferGeometry[] = [new THREE.CapsuleGeometry(r, len, 6, 14).rotateZ(Math.PI / 2)];
    for (let i = -1; i <= 1; i++)
      parts.push(
        new THREE.SphereGeometry(r * 0.42, 10, 8)
          .scale(1, 0.85, 1)
          .translate(-len / 2 - r * 0.72, r * 0.25, i * r * 0.55),
      );
    return mergeGeometries(parts)!;
  };
  const pawMat = clay('#7A84E4');
  const hind = new THREE.Mesh(pawGeo(0.24, 0.12), pawMat);
  hind.position.set(-0.38, -0.74, 0.5).sub(bodyC);
  hind.rotation.set(0.1, 0.5, -0.15);
  bodyG.add(hind);

  // ================= ÖN PATİLER =================
  const pawsG = new THREE.Group();
  root.add(pawsG);
  const paws: THREE.Mesh[] = [];
  // ön bacak: omuzdan (gövde içinden) öne uzanan kapsül, ucunda parmaklar
  const legLen = 0.4;
  const legGeo = pawGeo(legLen, 0.125).translate(-legLen / 2, 0, 0);
  const pawRest = [
    { p: new THREE.Vector3(-0.16, 0.03, 0.34), ry: 0.5 },
    { p: new THREE.Vector3(-0.06, -0.1, 0.44), ry: 0.28 },
  ];
  pawRest.forEach((r) => {
    const m = new THREE.Mesh(legGeo, pawMat);
    m.position.copy(r.p);
    m.rotation.set(0, r.ry, 0.06);
    pawsG.add(m);
    paws.push(m);
  });
  // pati altı pembe yastıkçıklar (esnerken görünür), pati yerel uzayında
  const beans = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), clay(C.pink), 8);
  const beanLocal: THREE.Matrix4[] = [];
  for (let i = 0; i < 8; i++) {
    const j = i % 4;
    const z = j === 3 ? 0 : (j - 1) * 0.07;
    const x = j === 3 ? -legLen - 0.06 : -legLen - 0.17;
    beanLocal.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, -0.1, z),
        q1.identity(),
        new THREE.Vector3(1, 0.6, 1).multiplyScalar(j === 3 ? 1.5 : 1),
      ),
    );
  }
  pawsG.add(beans);

  // ================= KAFA =================
  const headPivot = new THREE.Group(); // boyun
  headPivot.position.set(-0.3, 0.32, 0.12);
  root.add(headPivot);
  const headG = new THREE.Group();
  headG.position.set(-0.32, 0.12, 0.28);
  headG.scale.setScalar(1.08);
  headG.rotation.set(0.12, -0.42, 0.22);
  headPivot.add(headG);
  const headBlobs: Blob[] = [
    [0, 0.04, 0, 0.42, 0.38, 0.38], // kafatası
    [-0.17, -0.1, 0.1, 0.22, 0.19, 0.2], // yanak
    [0.17, -0.1, 0.1, 0.22, 0.19, 0.2],
    [0, -0.1, 0.27, 0.15, 0.1, 0.12], // ağız/burun çıkıntısı
  ];
  const headSdf = blobSdf(headBlobs, 0.12);
  const headC = new THREE.Vector3(0, 0, 0.02);
  const head = sdfMesh(headSdf, headC, 64, 44, (p, out) => {
    out.copy(C.furDark).lerp(C.fur, 0.35);
    // açık yüz maskesi (gözler ve ağız çevresi)
    const mask = smooth(0.12, 0.28, p.z + 0.02 - Math.max(0, p.y - 0.06) * 1.6);
    out.lerp(C.furLight, mask);
    const muzzle = smooth(0.24, 0.32, p.z) * smooth(0.0, -0.08, p.y);
    out.lerp(C.furPale, muzzle * 0.7);
    // alında "M" tekir çizgileri
    if (p.y > 0.2 && p.z > 0.12 && Math.abs(p.x) < 0.16) {
      const s = Math.abs(Math.sin(p.x * 30 + 1.57));
      out.lerp(C.furDark, smooth(0.85, 0.97, s) * smooth(0.22, 0.32, p.y) * 0.8);
    }
  });
  headG.add(new THREE.Mesh(head.geo, fur));
  const headR = head.R;
  /** Kafa yüzeyinde bir nokta ve normal. */
  const onHead = (x: number, y: number, z: number, lift = 0) => {
    const d = new THREE.Vector3(x, y, z).normalize();
    const p = d
      .clone()
      .multiplyScalar(headR(d) + lift)
      .add(headC);
    const n = sdfNormal(headSdf, p, new THREE.Vector3());
    return { p, n };
  };
  const orient = (o: THREE.Object3D, n: THREE.Vector3) =>
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);

  // kulaklar
  const ears: THREE.Group[] = [];
  const earBase = [0, 0];
  const earOuter = clay('#4B4DB0');
  [-1, 1].forEach((s, i) => {
    const e = new THREE.Group();
    const { p } = s < 0 ? onHead(-0.55, 0.85, 0.05, -0.04) : onHead(0.85, 0.42, 0.05, -0.04);
    e.position.copy(p);
    e.rotation.set(-0.1, 0, s < 0 ? 0.38 : -1.25);
    earBase[i] = e.rotation.z;
    const outer = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 0.27, 20).translate(0, 0.12, 0).scale(1, 1, 0.5),
      earOuter,
    );
    const inner = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.19, 16).translate(0, 0.1, 0).scale(1, 1, 0.35),
      clay(C.pink),
    );
    inner.position.set(0, 0.0, 0.035);
    e.add(outer, inner);
    headG.add(e);
    ears.push(e);
  });

  // gözler: kapalı yay (kirpikli) + aralanan açık göz
  const ink = clay(C.ink, { rough: 0.5 });
  const closedEyes: THREE.Mesh[] = [];
  const openEyes: THREE.Group[] = [];
  const lids: THREE.Group[] = [];
  const lidArc = new THREE.TorusGeometry(0.075, 0.016, 6, 18, Math.PI).rotateZ(Math.PI);
  const lashGeo = new THREE.CapsuleGeometry(0.008, 0.035, 2, 4);
  const eyeGeo = new THREE.SphereGeometry(0.075, 18, 14).scale(1, 1.1, 0.45);
  const shineGeo = new THREE.SphereGeometry(0.022, 8, 6);
  const shineMat = clay('#FFFFFF', { emissive: 0.6 });
  [-1, 1].forEach((s) => {
    const { p, n } = onHead(s * 0.38, 0.18, 0.92, 0.004);
    // kapalı göz yayı + iki kirpik tek geometri
    const lashes = [0, 1].map((k) =>
      lashGeo
        .clone()
        .rotateZ(s * (1.1 + k * 0.4))
        .translate(s * (0.075 + k * 0.012), -0.02 - k * 0.025, 0),
    );
    const m = new THREE.Mesh(mergeGeometries([lidArc, ...lashes])!, ink);
    m.position.copy(p);
    orient(m, n);
    m.rotateZ(s * 0.12);
    headG.add(m);
    closedEyes.push(m);
    const oe = new THREE.Group();
    oe.position.copy(p);
    orient(oe, n);
    const lid = new THREE.Group();
    const ball = new THREE.Mesh(eyeGeo, ink);
    const sh = new THREE.Mesh(shineGeo, shineMat);
    sh.position.set(0.025, 0.035, 0.03);
    lid.add(ball, sh);
    oe.add(lid);
    oe.visible = false;
    headG.add(oe);
    openEyes.push(oe);
    lids.push(lid);
  });

  // burun, ağız, esneme ağzı, yanak pembesi, bıyıklar
  {
    const { p, n } = onHead(0, -0.15, 1, 0.0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10).scale(1, 0.62, 0.6), clay(C.pink));
    nose.position.copy(p);
    orient(nose, n);
    headG.add(nose);
  }
  const mouth = new THREE.Group();
  {
    const { p, n } = onHead(0, -0.36, 1, 0.0);
    mouth.position.copy(p);
    orient(mouth, n);
    headG.add(mouth);
  }
  const smile = new THREE.Group();
  [-1, 1].forEach((s) => {
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.009, 5, 12, Math.PI).rotateZ(Math.PI), ink);
    a.position.set(s * 0.035, 0.005, 0);
    smile.add(a);
  });
  mouth.add(smile);
  const yawn = new THREE.Group();
  const yawnHole = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12).scale(0.9, 1, 0.4), clay('#6E2346'));
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8).scale(1, 0.6, 0.5), clay(C.pink));
  tongue.position.set(0, -0.04, 0.012);
  yawn.add(yawnHole, tongue);
  yawn.position.set(0, -0.03, -0.005);
  yawn.scale.setScalar(0.001);
  mouth.add(yawn);
  const blushMat = new THREE.MeshBasicMaterial({ color: C.pink, transparent: true, opacity: 0.55, depthWrite: false });
  [-1, 1].forEach((s) => {
    const { p, n } = onHead(s * 0.55, -0.32, 0.8, 0.005);
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), blushMat);
    c.position.copy(p);
    orient(c, n);
    headG.add(c);
  });
  {
    const parts: THREE.BufferGeometry[] = [];
    [-1, 1].forEach((s) => {
      for (let i = 0; i < 3; i++) {
        const { p } = onHead(s * 0.42, -0.3 - i * 0.05, 0.9, -0.01);
        const len = 0.34;
        const g = new THREE.CylinderGeometry(0.0055, 0.0035, len, 4).translate(0, len / 2, 0);
        g.rotateZ(-s * (Math.PI / 2 - 0.15 + i * 0.17));
        g.rotateY(-s * 0.25);
        g.translate(p.x, p.y, p.z);
        parts.push(g);
      }
    });
    headG.add(new THREE.Mesh(mergeGeometries(parts)!, clay('#ECEAFF', { emissive: 0.3 })));
  }

  // ================= GECE KÜLAHI =================
  const knit = knitTextures();
  const knitMat = (rx: number, ry: number) => {
    const map = knit.map.clone();
    const bump = knit.bump.clone();
    map.repeat.set(rx, ry);
    bump.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({
      map,
      bumpMap: bump,
      bumpScale: 2.2,
      roughness: 0.95,
      emissive: '#F7C548',
      emissiveIntensity: 0.06,
    });
  };
  const capG = new THREE.Group();
  {
    const top = onHead(0.32, 1, -0.12, 0);
    capG.position.copy(top.p).add(v1.set(-0.02, -0.12, 0));
    capG.rotation.set(-0.35, 0.3, -0.62);
    capG.scale.setScalar(0.82);
  }
  headG.add(capG);
  // kıvrık kenar (ribana)
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.085, 14, 40).rotateX(Math.PI / 2), knitMat(14, 2));
  brim.scale.set(1.05, 1, 0.95);
  capG.add(brim);
  // sarkık koni: lathe profili + bükme; ucunda püskül
  const capLen = 0.95,
    bendR = 0.48;
  const bend = (x: number, y: number, out: THREE.Vector3, z: number) => {
    const th = (y / bendR) * smooth(0, 0.6, y / capLen);
    const rr = bendR - x;
    return out.set(bendR - rr * Math.cos(th), rr * Math.sin(th) + y * 0.15, z);
  };
  {
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      prof.push(new THREE.Vector2(Math.max(0.012, 0.34 * (1 - u) ** 0.9 + 0.02 * Math.sin(u * 3)), u * capLen));
    }
    const g = new THREE.LatheGeometry(prof, 28);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      bend(pos.getX(i), pos.getY(i), v1, pos.getZ(i));
      pos.setXYZ(i, v1.x, v1.y, v1.z);
    }
    g.computeVertexNormals();
    const cone = new THREE.Mesh(g, knitMat(5, 4));
    cone.position.y = 0.02;
    capG.add(cone);
    let pg: THREE.BufferGeometry = new THREE.IcosahedronGeometry(0.15, 3);
    pg.deleteAttribute('uv');
    pg.deleteAttribute('normal');
    pg = mergeVertices(pg);
    const pp = pg.attributes.position as THREE.BufferAttribute;
    const rr = rng(5);
    const bumps = Array.from({ length: 40 }, () => new THREE.Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).normalize());
    for (let i = 0; i < pp.count; i++) {
      v1.fromBufferAttribute(pp, i).normalize();
      let f = 0;
      for (const b of bumps) f += Math.pow(Math.max(0, v1.dot(b)), 18);
      v1.multiplyScalar(0.15 * (1 + 0.16 * Math.min(1, f)));
      pp.setXYZ(i, v1.x, v1.y, v1.z);
    }
    pg.computeVertexNormals();
    const pom = new THREE.Mesh(pg, clay(C.cream, { rough: 1 }));
    bend(0, capLen, pom.position, 0);
    pom.position.y += 0.02;
    capG.add(pom);
  }

  // ================= Z Z Z =================
  const zTex = zTexture();
  const zs = [0, 1, 2].map(() => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0 }),
    );
    root.add(s);
    return s;
  });

  root.rotation.set(0.05, 0.12, -0.12);

  // ================= ANİMASYON =================
  const wake = new OneShot(3.4);
  let peek = 0;
  let earT = 2.5,
    earWho = 0,
    earAnim = -1;
  let flickT = 1.5,
    flickAnim = -1;
  const headRest = headG.position.clone();
  const headRot = headG.rotation.clone();
  const pawPos = pawRest.map((r) => r.p.clone());
  const zBase = new THREE.Vector3();
  const tmpM = new THREE.Matrix4();

  function update(s: { dt: number; t: number; hover: number; night: number; reduce: boolean }) {
    const { dt, t, hover, night, reduce } = s;
    const mot = reduce ? 0.25 : 1;
    const wp = wake.tick(dt);
    const on = wp >= 0 ? 1 : 0;
    const w = Math.max(0, wp);

    // uyanma hikayesi: kafa kalkar → esner → patiler gerilir, battaniye kayar → yeniden kıvrılır
    const lift = on * smooth(0.0, 0.14, w) * (1 - smooth(0.7, 0.95, w));
    const yawnK = on * smooth(0.14, 0.3, w) * (1 - smooth(0.42, 0.55, w));
    const stretchK = on * smooth(0.36, 0.5, w) * (1 - smooth(0.62, 0.82, w));
    const slip = on * smooth(0.3, 0.5, w) * (1 - ease.outElastic(smooth(0.66, 1.0, w)));
    const awakeEyes =
      on *
      smooth(0.04, 0.12, w) *
      Math.min(1, 1 - smooth(0.13, 0.2, w) + smooth(0.48, 0.56, w)) *
      (1 - smooth(0.68, 0.8, w));

    // nefes
    const br = Math.sin(t * 1.5) * mot * (1 - lift * 0.6);
    bodyG.scale.set(1 + br * 0.012, 1 + br * 0.028, 1 + br * 0.02);
    bodyG.position.y = bodyC.y + br * 0.01;

    // kafa
    headPivot.rotation.set(-lift * 0.5 - yawnK * 0.18, lift * 0.2, lift * 0.25 + Math.sin(t * 0.7) * 0.02 * mot);
    headG.position.set(headRest.x, headRest.y + br * 0.02 + lift * 0.1, headRest.z);
    headG.rotation.set(headRot.x - yawnK * 0.25, headRot.y + lift * 0.25, headRot.z - lift * 0.15);
    yawn.scale.set(Math.max(0.001, yawnK * 1.15), Math.max(0.001, yawnK * 1.6), Math.max(0.001, yawnK));
    smile.visible = yawnK < 0.15;

    // gözler: hover'da bir göz aralanır; uyanınca ikisi de açılır
    peek = damp(peek, hover > 0.3 ? 1 : 0, 6, dt);
    const open = [Math.max(peek * 0.85, awakeEyes), awakeEyes];
    open.forEach((o, i) => {
      lids[i].scale.set(1, Math.max(0.02, o), 1);
      openEyes[i].visible = o > 0.08;
      closedEyes[i].visible = o < 0.3;
    });

    // kulak seğirmesi
    earT -= dt * (1 + hover * 2);
    if (earT < 0 && !reduce) {
      earT = 2.5 + Math.random() * 3.5;
      earWho = Math.random() < 0.5 ? 0 : 1;
      earAnim = 0;
    }
    if (earAnim >= 0) {
      earAnim += dt / 0.45;
      if (earAnim >= 1) earAnim = -1;
    }
    const tw = earAnim >= 0 ? Math.sin(earAnim * Math.PI * 3) * (1 - earAnim) : 0;
    ears.forEach((e, i) => {
      const flat = yawnK * 0.35 * (i ? -1 : 1);
      e.rotation.z = earBase[i] + (i === earWho ? tw * 0.35 * (i ? -1 : 1) : 0) + flat;
      e.rotation.x = -0.1 - lift * 0.25 + (i === earWho ? Math.abs(tw) * 0.3 : 0);
    });

    // kuyruk ucu
    flickT -= dt * (1 + hover * 2.5);
    if (flickT < 0 && !reduce) {
      flickT = 1.8 + Math.random() * 2.5;
      flickAnim = 0;
    }
    if (flickAnim >= 0) {
      flickAnim += dt / 0.7;
      if (flickAnim >= 1) flickAnim = -1;
    }
    const fl = flickAnim >= 0 ? Math.sin(flickAnim * Math.PI * 2) * Math.sin(flickAnim * Math.PI) : 0;
    tipPivot.rotation.set(fl * 0.25, 0, Math.sin(t * 1.1) * 0.06 * mot + fl * 0.45 + stretchK * 0.4);

    // ön patiler: esneme
    paws.forEach((p, i) => {
      const k = stretchK * (i === 0 ? 1 : 0.85);
      p.position.set(pawPos[i].x - k * 0.06, pawPos[i].y + k * 0.03, pawPos[i].z + k * 0.04);
      p.rotation.z = 0.06 + k * 0.12;
      p.rotation.y = pawRest[i].ry - k * 0.35;
      p.scale.set(1 + k * 0.45, 1, 1);
      p.updateMatrix();
      for (let j = 0; j < 4; j++) {
        tmpM.multiplyMatrices(p.matrix, beanLocal[i * 4 + j]);
        beans.setMatrixAt(i * 4 + j, tmpM);
      }
    });
    beans.instanceMatrix.needsUpdate = true;
    beans.visible = stretchK > 0.05;
    pawsG.position.y = br * 0.008;

    // battaniye kayar
    blanketG.rotation.set(slip * 0.1, slip * 0.24, -slip * 0.26);
    blanketG.scale.setScalar(1 + slip * 0.06);

    // yıldızların gece parıltısı
    starGold.emissiveIntensity = 0.12 + night * 0.55 + hover * 0.15;
    starSilver.emissiveIntensity = 0.1 + night * 0.4;
    for (let i = 0; i < decoSpots.length; i++) {
      const tw2 = 0.5 + 0.5 * Math.sin(t * (1.3 + (i % 5) * 0.37) + i * 2.1);
      const k = (0.25 + 0.75 * tw2 * tw2) * (decoSpots[i].kind === 1 ? 0.6 : 1) * (0.08 + night * 0.92);
      glows.setColorAt(i, glowCol.setRGB(k, k * 0.92, k * 0.7));
    }
    glows.instanceColor!.needsUpdate = true;

    // z z z: kafadan sağ üste süzülür
    const sleepy = 1 - on * smooth(0, 0.1, w) * (1 - smooth(0.85, 1, w));
    headG.getWorldPosition(zBase);
    root.worldToLocal(zBase);
    zs.forEach((z, i) => {
      const life = (t * 0.28 + i / 3) % 1;
      z.position.set(
        zBase.x + 0.25 + life * 0.75 + Math.sin(life * 6 + i) * 0.08,
        zBase.y + 0.45 + life * 0.75,
        zBase.z + 0.15,
      );
      z.scale.setScalar(0.13 + life * 0.18);
      z.material.opacity = sleepy * Math.sin(life * Math.PI) * (reduce ? 0.6 : 1);
      z.material.rotation = Math.sin(life * 4 + i) * 0.3;
    });

    // bütün grubun yumuşak salınımı
    root.position.y = Math.sin(t * 0.55) * 0.04 * mot;
    root.rotation.z = -0.12 + Math.sin(t * 0.4) * 0.03 * mot;
    root.rotation.y = 0.12 + Math.sin(t * 0.23) * 0.08 * mot + hover * 0.06;
  }

  return {
    group,
    update,
    poke() {
      if (!wake.on || wake.p > 0.75) wake.start();
    },
  };
}
