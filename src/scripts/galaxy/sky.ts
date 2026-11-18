import * as THREE from 'three';

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export const DOT = dotTexture();

/**
 * Uzak arka plan yıldızları.
 * Gündüz: pastel renkli minik noktalar, büyükleri dört köşeli pırıltı (✦) gibi görünür.
 * Gece: beyaza yakın, parlak noktalar. Hepsi kendi ritminde hafifçe göz kırpar.
 */
const STAR_TINTS = ['#C7A4EC', '#F2A3C6', '#F0BE62', '#86CFC2', '#9CB2F6', '#F5A98A'];
export function createBackgroundStars(scene: THREE.Scene) {
  const n = 1500;
  const pos = new Float32Array(n * 3),
    col = new Float32Array(n * 3),
    phase = new Float32Array(n),
    size = new Float32Array(n);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const r = 110 + Math.random() * 160,
      th = Math.random() * Math.PI * 2,
      ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.cos(ph);
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    c.set(STAR_TINTS[i % STAR_TINTS.length]);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
    phase[i] = Math.random();
    // çoğu küçük nokta, yedide biri büyük pırıltı
    size[i] = i % 7 === 0 ? 3.4 + Math.random() * 2.4 : 0.9 + Math.random() * 1.1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uOpacity: { value: 0.7 }, uScale: { value: 400 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uScale;
      varying vec3 vColor;
      varying float vTw;
      varying float vBig;
      void main() {
        vColor = aColor;
        vTw = 0.62 + 0.38 * sin(uTime * (0.5 + aPhase * 1.4) + aPhase * 40.0);
        vBig = step(3.0, aSize);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale * (0.8 + 0.2 * vTw) / -mv.z, uScale * 0.06);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vTw;
      varying float vBig;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float d = length(p);
        float core = smoothstep(0.5, 0.0, d);
        // dört köşeli pırıltı: eksenlere yakın yerler parlar
        float flare = max(0.0, 1.0 - abs(p.x) * abs(p.y) * 110.0) * smoothstep(0.5, 0.04, d);
        float spark = pow(flare, 4.0) * 0.95 + pow(core, 7.0);
        float dot = pow(core, 1.6);
        float day = mix(dot * 0.55, spark * 0.9, vBig);
        float night = mix(pow(core, 2.2), spark * 0.9 + pow(core, 3.0) * 0.4, vBig);
        float a = mix(day, night, uNight) * uOpacity * mix(1.0, vTw, 0.35 + 0.65 * uNight);
        vec3 c = mix(vColor, mix(vColor, vec3(1.0), 0.7), uNight);
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}

/** Düzensiz, bulut gibi bir doku: büyük puslar bununla çizilir (düz daire gibi görünmesin). */
function puffTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2,
      d = Math.pow(Math.random(), 0.8) * s * 0.26,
      r = s * (0.1 + Math.random() * 0.17);
    const x = s / 2 + Math.cos(a) * d,
      y = s / 2 + Math.sin(a) * d;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.16)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
  }
  return new THREE.CanvasTexture(c);
}

const gauss = () => (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.7;

/**
 * Gece modunda galaksinin toz bulutu. Yapay görünmemesi için üç katman:
 * 1) iki sarmal kol boyunca öbekleşen ince toz taneleri (boyutları ve parlaklıkları çok değişken),
 * 2) kolların arasını dolduran seyrek, soluk taneler,
 * 3) kolların üzerinde yüzen büyük, düzensiz, çok soluk renkli puslar.
 * Kameraya yaklaşan taneler ve puslar sönerek kaybolur; gezegenlerin önünü kapatmaz.
 */
export function createDust(parent: THREE.Object3D) {
  const warm = new THREE.Color('#FFD9A0'),
    rose = new THREE.Color('#F28AC0'),
    violet = new THREE.Color('#9A8CF5'),
    teal = new THREE.Color('#6FD8D0'),
    white = new THREE.Color('#FFFFFF');
  const tint = (t: number, out: THREE.Color) => {
    // merkez sıcak, dışa doğru pembe, mor, en dışta hafif turkuaz
    if (t < 0.3) out.copy(warm).lerp(rose, t / 0.3);
    else if (t < 0.7) out.copy(rose).lerp(violet, (t - 0.3) / 0.4);
    else out.copy(violet).lerp(teal, ((t - 0.7) / 0.3) * 0.7);
    return out;
  };
  const armPoint = (arm: number, t: number, out: THREE.Vector3) => {
    // logaritmik sarmal: r büyüdükçe açı yavaş artar
    const r = 3 + t * 31;
    const ang = arm * Math.PI + 2.15 * Math.log(r / 3) + 0.5;
    return out.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
  };

  const vertexShader = /* glsl */ `
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aPhase;
    uniform float uScale;
    uniform float uTime;
    uniform float uMax;
    uniform float uNear;
    uniform float uFar;
    varying vec3 vColor;
    varying float vA;
    void main() {
      vColor = aColor;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = -mv.z;
      float px = aSize * uScale / d;
      gl_PointSize = min(px, uMax);
      // çok yaklaşan sönsün; çok küçülen de titreşmesin diye alfa ile telafi
      vA = smoothstep(uNear, uFar, d) * min(1.0, px / 1.2) * (0.72 + 0.28 * sin(uTime * (0.3 + aPhase) + aPhase * 50.0));
    }`;
  const mk = (n: number, tex: THREE.Texture | null, uMax: number, near: number, far: number) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(new Float32Array(n), 1));
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uScale: { value: 400 },
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uMax: { value: uMax },
        uNear: { value: near },
        uFar: { value: far },
        uMap: { value: tex },
      },
      vertexShader,
      fragmentShader: tex
        ? /* glsl */ `
        uniform sampler2D uMap; uniform float uOpacity; varying vec3 vColor; varying float vA;
        void main() { gl_FragColor = vec4(vColor, texture2D(uMap, gl_PointCoord).a * vA * uOpacity); }`
        : /* glsl */ `
        uniform float uOpacity; varying vec3 vColor; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a * a * vA * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    pts.visible = false;
    parent.add(pts);
    return pts;
  };

  const v = new THREE.Vector3(),
    c = new THREE.Color();
  // öbek merkezleri: kollar boyunca rastgele serpiştirilir
  const clumps = Array.from({ length: 46 }, (_, i) => {
    const t = Math.pow(Math.random(), 0.8);
    armPoint(i % 2, t, v);
    return { x: v.x + gauss() * 1.4, z: v.z + gauss() * 1.4, s: 0.7 + Math.random() * 1.9, t };
  });

  /* 1 + 2) taneler */
  const N = 8200;
  const grains = mk(N, null, 9, 2.5, 9);
  {
    const pos = grains.geometry.attributes.position as THREE.BufferAttribute,
      col = grains.geometry.attributes.aColor as THREE.BufferAttribute,
      size = grains.geometry.attributes.aSize as THREE.BufferAttribute,
      ph = grains.geometry.attributes.aPhase as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      const kind = Math.random();
      let t: number, x: number, z: number;
      if (kind < 0.46) {
        // sarmal kol: kolun eksenine yakın yoğun, dışa doğru seyrek
        t = Math.pow(Math.random(), 0.75);
        armPoint(i % 2, t, v);
        const w = 0.6 + t * 2.4;
        x = v.x + gauss() * w;
        z = v.z + gauss() * w;
      } else if (kind < 0.76) {
        const k = clumps[(Math.random() * clumps.length) | 0];
        t = k.t;
        x = k.x + gauss() * k.s;
        z = k.z + gauss() * k.s;
      } else if (kind < 0.86) {
        // merkezdeki şişkinlik
        t = 0;
        const r = Math.abs(gauss()) * 3.4,
          a = Math.random() * Math.PI * 2;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      } else {
        // kolların arası: seyrek disk
        const r = 4 + Math.sqrt(Math.random()) * 34,
          a = Math.random() * Math.PI * 2;
        t = (r - 3) / 31;
        x = Math.cos(a) * r;
        z = Math.sin(a) * r;
      }
      const r = Math.hypot(x, z);
      pos.setXYZ(i, x, gauss() * (0.28 + 0.9 * Math.exp(-r / 7)), z);
      tint(Math.min(1, t + gauss() * 0.12), c);
      // çoğu sönük, birkaçı parlak ve beyaza yakın
      const bright = Math.pow(Math.random(), 3.2);
      c.lerp(white, bright * 0.7).multiplyScalar(0.28 + bright * 0.9 + Math.random() * 0.25);
      col.setXYZ(i, c.r, c.g, c.b);
      size.setX(i, 0.07 + Math.pow(Math.random(), 4) * 0.34 + bright * 0.12);
      ph.setX(i, Math.random());
    }
  }

  /* 3) puslar */
  const H = 130;
  const haze = mk(H, puffTexture(), 520, 9, 30);
  {
    const pos = haze.geometry.attributes.position as THREE.BufferAttribute,
      col = haze.geometry.attributes.aColor as THREE.BufferAttribute,
      size = haze.geometry.attributes.aSize as THREE.BufferAttribute,
      ph = haze.geometry.attributes.aPhase as THREE.BufferAttribute;
    for (let i = 0; i < H; i++) {
      const t = Math.pow(Math.random(), 0.7);
      armPoint(i % 2, t, v);
      const w = 1 + t * 2.5;
      pos.setXYZ(i, v.x + gauss() * w, gauss() * 0.5 - 0.4, v.z + gauss() * w);
      tint(Math.min(1, Math.max(0, t + gauss() * 0.2)), c).multiplyScalar(0.5 + Math.random() * 0.5);
      col.setXYZ(i, c.r, c.g, c.b);
      size.setX(i, 7 + Math.random() * 11);
      ph.setX(i, Math.random() * 0.3);
    }
  }

  return {
    /** Her karede: gece miktarına göre görünürlük, kameraya göre nokta ölçeği. */
    update(night: number, time: number, camera: THREE.PerspectiveCamera, dpr: number) {
      const on = night > 0.01;
      grains.visible = haze.visible = on;
      if (!on) return;
      const scale = (innerHeight * dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      for (const p of [grains, haze]) {
        const u = (p.material as THREE.ShaderMaterial).uniforms;
        u.uScale.value = scale;
        u.uTime.value = time;
      }
      (grains.material as THREE.ShaderMaterial).uniforms.uOpacity.value = night * 0.85;
      (grains.material as THREE.ShaderMaterial).uniforms.uMax.value = 9 * dpr;
      (haze.material as THREE.ShaderMaterial).uniforms.uOpacity.value = night * 0.2;
      (haze.material as THREE.ShaderMaterial).uniforms.uMax.value = 520 * dpr;
    },
  };
}

/**
 * Yay (Sagittarius) takımyıldızı, "çaydanlık" biçimiyle.
 * Konumlar gerçek gök koordinatlarından (sağ açıklık / dik açıklık) sadeleştirildi.
 */
const SGR: Record<string, [number, number]> = {
  alnasl: [18.097, -30.42], // γ² Sgr
  kausMedia: [18.35, -29.83], // δ Sgr
  kausAustralis: [18.403, -34.38], // ε Sgr
  kausBorealis: [18.466, -25.42], // λ Sgr
  phi: [18.761, -26.99],
  nunki: [18.921, -26.3], // σ Sgr
  tau: [19.115, -27.67],
  ascella: [19.043, -29.88], // ζ Sgr
};
const SGR_EDGES: [string, string][] = [
  ['alnasl', 'kausMedia'],
  ['kausMedia', 'kausAustralis'],
  ['kausAustralis', 'alnasl'],
  ['kausMedia', 'kausBorealis'],
  ['kausBorealis', 'phi'],
  ['phi', 'kausMedia'],
  ['phi', 'nunki'],
  ['nunki', 'tau'],
  ['tau', 'ascella'],
  ['ascella', 'phi'],
  ['ascella', 'kausAustralis'],
];

export interface Constellation {
  group: THREE.Group;
  lines: THREE.LineSegments;
  stars: THREE.Points;
  progress: number;
}

/** Takımyıldızı kameraya bağlı: gerçek yıldızlar gibi sonsuz uzakta, ekranın sağ üstünde durur. */
export function createSagittarius(parent: THREE.Object3D): Constellation {
  const group = new THREE.Group();
  const names = Object.keys(SGR);
  const cx = 18.6,
    cy = -28.5,
    scale = 9;
  const toV = (k: string) => {
    const [ra, dec] = SGR[k];
    return new THREE.Vector3(-(ra - cx) * 15 * scale * 0.09, (dec - cy) * scale * 0.09 * 1.0, 0).multiplyScalar(4);
  };
  const pPos = new Float32Array(names.length * 3);
  names.forEach((k, i) => {
    const v = toV(k);
    pPos[i * 3] = v.x;
    pPos[i * 3 + 1] = v.y;
    pPos[i * 3 + 2] = v.z;
  });
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const stars = new THREE.Points(
    sg,
    new THREE.PointsMaterial({
      size: 2.2,
      map: DOT,
      color: '#E3A93B',
      transparent: true,
      depthWrite: false,
    }),
  );
  group.add(stars);

  const lPos = new Float32Array(SGR_EDGES.length * 6);
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(lPos, 3));
  const lines = new THREE.LineSegments(
    lg,
    new THREE.LineBasicMaterial({
      color: '#E3A93B',
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  group.add(lines);

  group.renderOrder = 5;
  parent.add(group);
  const c: Constellation = { group, lines, stars, progress: 0 };
  (c as any).ends = SGR_EDGES.map(([a, b]) => [toV(a), toV(b)]);
  return c;
}

/** Çizgileri bir kalemle çiziyormuş gibi sırayla belirginleştirir. */
export function drawConstellation(c: Constellation, target: number, dt: number) {
  c.progress += (target - c.progress) * Math.min(1, dt * 0.8);
  const ends = (c as any).ends as [THREE.Vector3, THREE.Vector3][];
  const pos = c.lines.geometry.attributes.position as THREE.BufferAttribute;
  ends.forEach(([a, b], i) => {
    const t = Math.min(1, Math.max(0, c.progress * ends.length * 0.35 - i * 0.35));
    pos.setXYZ(i * 2, a.x, a.y, a.z);
    pos.setXYZ(i * 2 + 1, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
  });
  pos.needsUpdate = true;
}

/** Kayan yıldızlar: ekranın üstünde ara sıra çapraz bir çizgi. Ucuz olsun diye CSS ile. */
export function startShootingStars(layer: HTMLElement, reduce: boolean) {
  if (reduce) return;
  const spawn = () => {
    const el = document.createElement('i');
    el.className = 'shooting-star';
    el.style.left = `${10 + Math.random() * 70}%`;
    el.style.top = `${5 + Math.random() * 35}%`;
    el.style.setProperty('--len', `${120 + Math.random() * 120}px`);
    layer.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
    setTimeout(spawn, 3500 + Math.random() * 6000);
  };
  setTimeout(spawn, 2000);
}
