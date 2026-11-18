import * as THREE from 'three';
import { CHARACTERS } from './characters';
import type { Character } from './characters/kit';
import { planetVertex, planetFragment, atmosphereFragment, ringVertex, ringFragment } from './shaders';

const SURFACES = { bands: 0, rocky: 1, swirl: 2, ice: 3, lava: 4 } as const;
export type Surface = keyof typeof SURFACES;

export interface PlanetOptions {
  key: string;
  name: string;
  color: string;
  surface: Surface;
  orbit: number;
  size: number;
  speed: number;
  phase: number;
  y?: number;
  ring?: boolean;
  posts?: string[];
  /** Kodla kurulmuş karakter (characters/ içindeki anahtar). Varsa küre yerine o görünür. */
  char?: string;
}

export interface PlanetBody {
  opts: PlanetOptions;
  pivot: THREE.Object3D;
  holder: THREE.Object3D;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  atmosphere: THREE.Mesh;
  ring?: THREE.Mesh;
  orbitLine: THREE.Line;
  /** Yazı yıldızları: konum/ölçek taşıyan boş nesneler; çizimi tek bir InstancedMesh yapar (100 yazıda bile tek çizim çağrısı). */
  stars: THREE.Object3D[];
  starMesh?: THREE.InstancedMesh;
  spokes?: THREE.LineSegments;
  chain?: THREE.LineSegments;
  hover: number;
  label: HTMLElement;
  character?: Character;
  charWrap?: THREE.Object3D;
  charHover: number;
}

const LIGHT = new THREE.Vector3(-0.6, 0.8, 0.5);
const starGeo = new THREE.OctahedronGeometry(0.14, 0);

export function createPlanet(parent: THREE.Object3D, o: PlanetOptions, labelLayer: HTMLElement): PlanetBody {
  const pivot = new THREE.Object3D();
  pivot.rotation.y = o.phase;
  parent.add(pivot);

  const holder = new THREE.Object3D();
  holder.position.set(o.orbit, o.y ?? 0, 0);
  pivot.add(holder);

  const color = new THREE.Color(o.color);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  const shade = new THREE.Color().setHSL((hsl.h + 0.97) % 1, Math.min(1, hsl.s * 0.9), hsl.l * 0.62);

  const material = new THREE.ShaderMaterial({
    vertexShader: planetVertex,
    fragmentShader: planetFragment,
    uniforms: {
      uColor: { value: color },
      uShade: { value: shade },
      uLight: { value: LIGHT },
      uTime: { value: 0 },
      uSurface: { value: SURFACES[o.surface] },
      uNight: { value: 0 },
      uGlow: { value: 0 },
      uSeed: { value: Math.random() * 10 },
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.size, 64, 64), material);
  mesh.rotation.z = 0.25;
  holder.add(mesh);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(o.size * 1.18, 48, 48),
    new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: atmosphereFragment,
      uniforms: { uColor: { value: color.clone().lerp(new THREE.Color('#ffffff'), 0.35) }, uStrength: { value: 0.6 } },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    }),
  );
  holder.add(atmosphere);

  let ring: THREE.Mesh | undefined;
  if (o.ring) {
    const inner = o.size * 1.45,
      outer = o.size * 2.3;
    ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 128),
      new THREE.ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        uniforms: {
          uColor: { value: color },
          uInner: { value: inner },
          uOuter: { value: outer },
          uOpacity: { value: 0.85 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = Math.PI / 2.25;
    ring.rotation.y = 0.25;
    holder.add(ring);
  }

  // yörünge çizgisi (kesikli, kalem çizgisi gibi)
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * o.orbit, o.y ?? 0, Math.sin(a) * o.orbit));
  }
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color: '#4a3a55', transparent: true, opacity: 0.3, dashSize: 0.32, gapSize: 0.22 }),
  );
  orbitLine.computeLineDistances();
  parent.add(orbitLine);

  // yazılar = gezegenin etrafındaki yıldızlar + üzerine gelince çizilen bağlantı çizgileri
  const stars: THREE.Object3D[] = [];
  let starMesh: THREE.InstancedMesh | undefined;
  let spokes: THREE.LineSegments | undefined;
  let chain: THREE.LineSegments | undefined;
  if (o.posts?.length) {
    const n = o.posts.length;
    // Yazı sayısı arttıkça yıldızlar tek sıra halinde dışarı taşmaz: gezegenin etrafında
    // altın açıyla dizilen bir yıldız kuşağı oluşur. Kuşağın genişliği sınırlıdır, yıldızlar küçülür.
    const r0 = o.size * 2.3;
    const spread = Math.min(2.3, 0.62 * Math.sqrt(n));
    const k = n <= 8 ? 1 : Math.max(0.5, 1 - (n - 8) * 0.0075);
    starMesh = new THREE.InstancedMesh(
      starGeo,
      new THREE.MeshBasicMaterial({ color: '#E3A93B', transparent: true }),
      n,
    );
    starMesh.frustumCulled = false;
    holder.add(starMesh);
    for (let i = 0; i < n; i++) {
      const a = n <= 8 ? (i / n) * Math.PI * 2 + o.phase : i * 2.39996 + o.phase;
      const r = r0 + spread * Math.sqrt((i + 0.5) / n);
      const star = new THREE.Object3D();
      star.position.set(Math.cos(a) * r, o.size * (n <= 8 ? 0.6 : 0.42) * Math.sin(a * 1.7 + i), Math.sin(a) * r);
      star.userData.k = k * (0.85 + ((i * 7) % 5) * 0.075);
      holder.add(star);
      stars.push(star);
    }
    const mk = (c: THREE.ColorRepresentation) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
      const l = new THREE.LineSegments(
        g,
        new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false }),
      );
      holder.add(l);
      return l;
    };
    spokes = mk(o.color);
    chain = mk('#E3A93B');
  }

  const label = document.createElement('div');
  label.className = 'planet-label';
  label.textContent = o.name;
  label.style.setProperty('--c', o.color);
  labelLayer.appendChild(label);

  // karakter: küre görünmez olur ama fareyle seçmek için yerinde (biraz büyütülmüş) kalır
  let character: Character | undefined;
  let charWrap: THREE.Object3D | undefined;
  const make = o.char ? CHARACTERS[o.char] : undefined;
  try {
    character = make?.();
  } catch (e) {
    console.error(`karakter kurulamadı: ${o.char}`, e); // bozuk bir karakter tüm galaksiyi düşürmesin
  }
  if (character) {
    // karakter kendi grubunu serbestçe oynatabilsin diye ölçek ayrı bir kapta
    const wrap = new THREE.Group();
    wrap.scale.setScalar(o.size);
    wrap.add(character.group);
    holder.add(wrap);
    charWrap = wrap;
    material.visible = false;
    mesh.scale.setScalar(1.35);
    atmosphere.visible = false;
    if (ring) ring.visible = false;
  }

  const body: PlanetBody = {
    opts: o,
    pivot,
    holder,
    mesh,
    material,
    atmosphere,
    ring,
    orbitLine,
    stars,
    starMesh,
    spokes,
    chain,
    hover: 0,
    label,
    character,
    charWrap,
    charHover: 0,
  };
  mesh.userData.body = body;
  return body;
}

/** Üzerine gelince yıldızlar sırayla gezegene, sonra birbirine bağlanır. */
export function animateConnections(b: PlanetBody, target: number, dt: number, reduce: boolean) {
  if (!b.spokes || !b.chain) return;
  b.hover += (target - b.hover) * Math.min(1, dt * (target ? 3 : 5));
  if (reduce) b.hover = target;
  const h = b.hover,
    n = b.stars.length;
  const sp = b.spokes.geometry.attributes.position as THREE.BufferAttribute;
  const ch = b.chain.geometry.attributes.position as THREE.BufferAttribute;
  for (let j = 0; j < n; j++) {
    const s = b.stars[j].position;
    const t = Math.min(1, Math.max(0, h * 1.7 - j * Math.min(0.12, 0.7 / n)));
    sp.setXYZ(j * 2, 0, 0, 0);
    sp.setXYZ(j * 2 + 1, s.x * t, s.y * t, s.z * t);
    const nx = b.stars[(j + 1) % n].position;
    const c = Math.min(1, Math.max(0, h * 2 - 1));
    ch.setXYZ(j * 2, s.x, s.y, s.z);
    ch.setXYZ(j * 2 + 1, s.x + (nx.x - s.x) * c, s.y + (nx.y - s.y) * c, s.z + (nx.z - s.z) * c);
    b.stars[j].scale.setScalar((1 + h * (n > 8 ? 0.5 : 1.1)) * (b.stars[j].userData.k as number));
  }
  sp.needsUpdate = true;
  ch.needsUpdate = true;
  (b.spokes.material as THREE.LineBasicMaterial).opacity = h * (n > 8 ? 0.28 : 0.9);
  (b.chain.material as THREE.LineBasicMaterial).opacity = n > 1 ? h * (n > 8 ? 0.14 : 0.5) : 0;
  b.material.uniforms.uGlow.value = h;
}

/** Yıldızların konum/ölçek/dönüşünü tek çizim çağrılı kümeye aktarır (her karede). */
export function syncStars(b: PlanetBody) {
  if (!b.starMesh) return;
  for (let j = 0; j < b.stars.length; j++) {
    b.stars[j].updateMatrix();
    b.starMesh.setMatrixAt(j, b.stars[j].matrix);
  }
  b.starMesh.instanceMatrix.needsUpdate = true;
}
