import * as THREE from 'three';
import { createPlanet, animateConnections, syncStars, type PlanetBody } from './planets';
import { createBackgroundStars, createDust, createSagittarius, drawConstellation, startShootingStars } from './sky';
import { planetVertex, sunFragment } from './shaders';
import { Ufo } from './ufo';
import { Alien } from './alien';
import { Meteors } from './meteors';
import { CHARACTERS } from './characters';
import type { Character, CharacterState } from './characters/kit';
import { confetti } from './effects';
import { DOT } from './sky';
import { topics, posts, hobbies } from '../../data/site';
import { L, lang, translate } from '../i18n';

export type Theme = 'day' | 'night';

interface GalaxyOptions {
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  reduce: boolean;
  onPlanet: (b: PlanetBody) => void;
  onSection: (i: number) => void;
  /** Tutulmanın tam anı: yeni tema sayfaya uygulanır, dalga güneşten yayılır. */
  onWave: (x: number, y: number, t: Theme) => void;
  /** Bir gezegen yakından incelenmeye başladı (ya da null: inceleme bitti). */
  onInspect: (b: PlanetBody | null, index: number, total: number) => void;
  /** Bir yazı yıldızına tıklandı. */
  onStar: (b: PlanetBody, index: number) => void;
  /** true: açılışta galaksi görünmez bekler; Big Bang'i `bigBang()` başlatır (bkz. intro.ts). */
  holdIntro?: boolean;
}

const SCOPE_FOV = 30;

const THEMES = {
  day: {
    orbit: '#4a3a55',
    orbitOpacity: 0.28,
    bgStar: '#8D7FA6',
    bgOpacity: 0.72,
    dust: 0,
    sunA: '#FFE7BF',
    sunB: '#FFB07A',
    atmo: 0.45,
    line: '#E3A93B',
  },
  night: {
    orbit: '#C9C0E0',
    orbitOpacity: 0.12,
    bgStar: '#FFFFFF',
    bgOpacity: 1,
    dust: 0.9,
    sunA: '#FFE08A',
    sunB: '#FF7A59',
    atmo: 0.9,
    line: '#F5C45E',
  },
};

export class Galaxy {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.1, 800);
  private world = new THREE.Group();
  private bodies: PlanetBody[] = [];
  private about!: PlanetBody;
  private growth!: PlanetBody;
  private contact!: PlanetBody;
  private moons: THREE.Mesh[] = [];
  private sunMat: THREE.ShaderMaterial;
  private bgStars: THREE.Points;
  private dust: ReturnType<typeof createDust>;
  private alien: Alien;
  private meteors: Meteors;
  private sgr;
  private ufo: Ufo;
  private cat: Character;
  private sunChar: Character;
  private sunWrap = new THREE.Group();
  private catWrap = new THREE.Group();
  private charState: CharacterState = { dt: 0, t: 0, hover: 0, night: 0, reduce: false, camera: new THREE.Camera() };
  private hoveredAny: PlanetBody | null = null;
  private sunHover = 0;
  private catHover = 0;
  private catVis = 0;
  private sunVis = 1;
  private sunSpin = 0;
  private sunPulse = 0;
  private sunRoll = 0;
  private hoverCat = false;
  private sun: THREE.Mesh;
  private corona: THREE.Sprite;
  private morph: { t: number; next: Theme; from: number; waved: boolean } | null = null;
  private moonness = 0;
  private flash: THREE.Sprite;
  private shock: THREE.Mesh;
  private intro = -1;
  private introHold = false;
  private night = 0;
  private nightTarget = 0;
  private theme: Theme = 'day';
  /** Yakından incelenen gezegen: kamera onun çevresinde döner (az/el açıları, zoom çarpanı). */
  private insp: { b: PlanetBody; az: number; el: number; zoom: number } | null = null;
  private drag: { x: number; y: number; x0: number; y0: number; pinch: number } | null = null;
  private touches = new Map<number, { x: number; y: number }>();
  private dragged = false;
  /** Bölüme göre etiketlerin girmemesi gereken ekran alanı (karşılama başlığı, gökyüzü başlığı). */
  avoid: Record<number, DOMRect | undefined> = {};
  private scopeOn = false;
  private scopeR = 200;
  private scopeIdx = 0;
  /** Serbest gezinti: kamera galaksi düzlemindeki bir noktaya bakar; sürükle = kaydır, tekerlek = yakınlaş. */
  private explore: { x: number; z: number; yaw: number; pitch: number; dist: number } | null = null;
  private hoverStar: { b: PlanetBody; j: number } | null = null;
  private coarse = false;
  /** Geliştirme: kamerayı sabit bir yere koyar (ekran görüntüsü almak için). */
  debug: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  private sgrLabel: HTMLElement;
  private sgrHover = false;
  private holdFrames = 0;
  private sgrGlow = 0;
  private flight: {
    t: number;
    dur: number;
    to: number;
    from: THREE.Vector3;
    fromLook: THREE.Vector3;
    done?: () => void;
  } | null = null;
  private sgrVis = 0;
  private sgrBox = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private hoverSun = false;
  private hoverUfo = false;
  private tip: HTMLElement;
  private pointer = { x: 0, y: 0, px: -999, py: -999, active: false, overUi: false };
  private ray = new THREE.Raycaster();
  private hovered: PlanetBody | null = null;
  private pinned: PlanetBody | null = null;
  private lastFrame = performance.now();
  private time = 0;
  private lastPick = 0;
  private section = -1;
  private cam = { pos: new THREE.Vector3(0, 16, 32), look: new THREE.Vector3() };
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();

  constructor(private o: GalaxyOptions) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: o.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.scene.add(this.world);
    this.scene.add(this.camera); // takımyıldızı kameraya bağlı

    // ışıklar (sadece 3D baş modeli için; gezegenler kendi ışığını shader'da hesaplıyor)
    this.scene.add(new THREE.HemisphereLight('#FFF4EC', '#B9A6D6', 1.4));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.2);
    key.position.set(-4, 6, 8);
    this.scene.add(key);

    // güneş
    this.sunMat = new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: sunFragment,
      uniforms: {
        uTime: { value: 0 },
        uA: { value: new THREE.Color(THEMES.day.sunA) },
        uB: { value: new THREE.Color(THEMES.day.sunB) },
        uMoon: { value: 0 },
      },
    });
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(2.1, 64, 64), this.sunMat);
    this.world.add(this.sun);
    this.corona = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: DOT,
        color: '#FFD089',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.corona.scale.setScalar(8);
    this.scene.add(this.corona);
    // Big Bang: açılışta merkezde parlayan ışık ve yayılan şok halkası
    this.flash = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: DOT,
        color: '#FFF6E0',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(this.flash);
    this.shock = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 128),
      new THREE.MeshBasicMaterial({
        color: '#FFE3B0',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.shock.rotation.x = -Math.PI / 2;
    this.scene.add(this.shock);
    this.introHold = !!o.holdIntro;

    this.bgStars = createBackgroundStars(this.scene);
    this.dust = createDust(this.world);
    this.sgr = createSagittarius(this.scene);

    // gezegenler
    this.about = this.add({
      key: 'about',
      char: 'about',
      name: L('Hakkımda'),
      color: '#F2766B',
      surface: 'swirl',
      orbit: 8,
      size: 1.05,
      speed: 0.045,
      phase: 0.6,
    });
    this.growth = this.add({
      key: 'growth',
      char: 'growth',
      name: L('Gelişim alanım'),
      color: '#F7C548',
      surface: 'bands',
      orbit: 10.7,
      size: 0.9,
      speed: 0.035,
      phase: 2.9,
      ring: true,
    });
    topics.forEach((t, i) => {
      this.add({
        key: 'topic',
        char: t.id,
        name: L(t.name),
        color: t.color,
        surface: t.surface,
        ring: t.ring,
        orbit: 13.5 + i * 1.85,
        size: 0.62 + ((i * 5) % 4) * 0.05,
        speed: 0.03 - i * 0.0018,
        phase: i * 2.399 + 0.4, // altın açı: komşu yörüngeler birbirinden uzak durur
        y: Math.sin(i * 1.9) * 0.4,
        posts: posts.filter((p) => p.planet === t.id).map((p) => p.title),
      });
    });
    this.contact = this.add({
      key: 'contact',
      char: 'contact',
      name: L('Bana ulaşın'),
      color: '#4FC7B8',
      surface: 'ice',
      orbit: 29.8,
      size: 1.05,
      speed: 0.012,
      phase: 4.2,
    });
    // hobilerim: en dış kuşakta aynı hızla dönen üç gezegen (aralarındaki mesafe hep aynı kalır)
    hobbies.forEach((h, j) => {
      this.add({
        key: 'hobby',
        char: h.id,
        name: L(h.name),
        color: h.color,
        surface: 'swirl',
        orbit: 33.4,
        size: 0.85,
        speed: 0.009,
        phase: 1.1 + j * 2.094,
        y: 0.3,
      });
    });

    this.ufo = new Ufo(this.scene);
    this.alien = new Alien(this.scene);
    this.meteors = new Meteors(this.scene);
    // merkez: gündüz ayçiçeği güneş, gece uyuyan kedi-ay (ikisi de kodla kurulu karakter)
    this.sunChar = safeChar('sun');
    this.sunWrap.add(this.sunChar.group);
    this.world.add(this.sunWrap);
    this.sunMat.visible = false; // eski küre yalnızca fareyle seçmek için kalır
    this.cat = safeChar('moon');
    this.catWrap.add(this.cat.group);
    this.world.add(this.catWrap);

    this.sgrLabel = document.createElement('div');
    this.sgrLabel.className = 'sgr-label';
    this.sgrLabel.textContent = lang === 'en' ? '♐\uFE0E Sagittarius' : '♐\uFE0E Yay';
    o.labels.appendChild(this.sgrLabel);

    this.tip = document.createElement('div');
    this.tip.className = 'planet-tip';
    o.labels.appendChild(this.tip);
    startShootingStars(o.labels, o.reduce);

    addEventListener('resize', this.resize);
    addEventListener('pointermove', (e) => {
      this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
      this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
      this.pointer.px = e.clientX;
      this.pointer.overUi = !!(e.target as HTMLElement)?.closest?.(
        'button, a, input, .panel, .drawer, .skyhead, .reader, .top, .hud, .scope, .pagebar, .rail',
      );
      this.pointer.py = e.clientY;
      this.pointer.active = true;
    });
    addEventListener('pointerdown', (e) => (this.coarse = e.pointerType !== 'mouse'), true);
    addEventListener('click', this.onClick);
    this.bindInspect(o.canvas);
    this.fov = this.baseFov();
    this.resize();
    // kamera ilk karede yerinde olsun (açılış, galaksinin doğacağı noktayı buradan öğrenir)
    this.keyframe(Math.round(scrollY / innerHeight), this.cam.pos, this.cam.look);
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
    this.camera.updateMatrixWorld();
    this.renderer.setAnimationLoop(this.frame);
  }

  private add(opts: Parameters<typeof createPlanet>[1]) {
    const b = createPlanet(this.world, opts, this.o.labels);
    this.bodies.push(b);
    return b;
  }

  /** Temayı anında uygular (sayfa ilk açıldığında). */
  setTheme(t: Theme) {
    this.applyTheme3D(t);
    this.night = this.nightTarget;
    if (!this.morph) this.moonness = this.nightTarget;
  }

  /** Gece/gündüz: merkezdeki güneş dönerek aya (ya da ay güneşe) dönüşür. */
  switchTheme(t: Theme) {
    if (this.morph) return;
    if (this.o.reduce) {
      const p = this.sunScreen();
      this.o.onWave(p.x, p.y, t);
      this.moonness = t === 'night' ? 1 : 0;
      return;
    }
    this.morph = { t: 0, next: t, from: this.moonness, waved: false };
  }

  /** Görünüm geçişi (view transition) sırasında yeni hâlin hemen çizilmesi için. */
  renderNow() {
    this.frame();
  }

  get currentTheme() {
    return this.theme;
  }

  private applyTheme3D(t: Theme) {
    this.theme = t;
    const th = THEMES[t];
    const night = t === 'night' ? 1 : 0;
    this.nightTarget = night;
    (this.corona.material as THREE.SpriteMaterial).blending = night ? THREE.AdditiveBlending : THREE.NormalBlending;
    (this.corona.material as THREE.SpriteMaterial).needsUpdate = true;
    this.bodies.forEach((b) => {
      (b.orbitLine.material as THREE.LineDashedMaterial).color.set(th.orbit);
      (b.orbitLine.material as THREE.LineDashedMaterial).opacity = th.orbitOpacity;
      (b.atmosphere.material as THREE.ShaderMaterial).uniforms.uStrength.value = th.atmo;
      (b.atmosphere.material as THREE.ShaderMaterial).blending = night ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (b.starMesh) (b.starMesh.material as THREE.MeshBasicMaterial).color.set(th.line);
      if (b.chain) (b.chain.material as THREE.LineBasicMaterial).color.set(th.line);
    });
    const bg = this.bgStars.material as THREE.ShaderMaterial;
    bg.uniforms.uOpacity.value = th.bgOpacity;
    bg.blending = night ? THREE.AdditiveBlending : THREE.NormalBlending;
    bg.needsUpdate = true;
    this.sunMat.uniforms.uA.value.set(th.sunA);
    this.sunMat.uniforms.uB.value.set(th.sunB);
    (this.sgr.stars.material as THREE.PointsMaterial).color.set(th.line);
    (this.sgr.lines.material as THREE.LineBasicMaterial).color.set(th.line);
  }

  /** Uzay gemisi ekrandaysa ekrandaki yeri (rehber ona bakar). */
  ufoScreen(): { x: number; y: number } | null {
    if (!this.ufo.flying || !this.ufo.group.visible) return null;
    this.tmp.copy(this.ufo.group.position).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * innerWidth, y: (-this.tmp.y * 0.5 + 0.5) * innerHeight };
  }

  /** Teleskop: kamera merceğin gösterdiği gezegene döner. `radius`: merceğin ekrandaki yarıçapı (piksel). */
  openScope(index: number, lens: { x: number; y: number; r: number }) {
    this.scopeOn = true;
    this.scopeIdx = index;
    this.pinned = null;
    this.setScopeLens(lens);
  }
  /** Mercek ekranın ortasında olmayabilir: görüntünün merkezi merceğin merkezine kaydırılır. */
  setScopeLens(lens: { x: number; y: number; r: number }) {
    this.scopeR = lens.r;
    const w = innerWidth,
      h = innerHeight;
    this.camera.setViewOffset(w, h, w / 2 - lens.x, h / 2 - lens.y, w, h);
    this.camera.updateProjectionMatrix();
  }
  closeScope() {
    this.scopeOn = false;
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  /** Gece/gündüz dönüşümü sürüyor mu? */
  get morphing() {
    return !!this.morph;
  }
  setScopeTarget(i: number) {
    const n = this.bodies.length;
    this.scopeIdx = ((i % n) + n) % n;
  }
  get planets() {
    return this.bodies;
  }
  /** Gezegenin ekrandaki yeri (piksel). */
  screenOf(b: PlanetBody) {
    b.holder.getWorldPosition(this.tmp).project(this.camera);
    return { x: (this.tmp.x * 0.5 + 0.5) * innerWidth, y: (-this.tmp.y * 0.5 + 0.5) * innerHeight };
  }

  private scopeGoal(pos: THREE.Vector3, look: THREE.Vector3) {
    const b = this.bodies[this.scopeIdx];
    const P = b.holder.getWorldPosition(look);
    const r = this.scopeR;
    // gezegen (süsleriyle birlikte) merceğin yaklaşık üçte ikisini doldursun
    const R = b.opts.size * 2.05;
    const d = (R * innerHeight) / (2 * Math.tan(THREE.MathUtils.degToRad(SCOPE_FOV / 2)) * 0.82 * r);
    // yörüngeye teğet yönden, hafif yukarıdan bakar: güneş görüş alanının dışında kalır
    const rx = P.x,
      rz = P.z,
      l = Math.hypot(rx, rz) || 1;
    pos.set(
      P.x + (-rz / l) * d * 0.94 + (rx / l) * d * 0.12,
      P.y + d * 0.3,
      P.z + (rx / l) * d * 0.94 + (rz / l) * d * 0.12,
    );
  }

  /* ---------- serbest gezinti ---------- */
  get exploring() {
    return !!this.explore;
  }
  setExplore(on: boolean) {
    if (!on) {
      this.explore = null;
      if (this.insp) this.inspect(null);
      return;
    }
    const m = this.mobile();
    this.explore = { x: 0, z: 0, yaw: 0, pitch: 0.92, dist: m ? 74 : 52 };
  }
  /** Yakınlaş (k < 1) ya da uzaklaş (k > 1). */
  exploreZoom(k: number) {
    if (this.insp) this.insp.zoom = Math.min(1.7, Math.max(0.5, this.insp.zoom * k));
    else if (this.explore) this.explore.dist = Math.min(130, Math.max(9, this.explore.dist * k));
  }
  explorePan(dx: number, dy: number) {
    const E = this.explore;
    if (!E) return;
    const sc = (E.dist * 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / innerHeight;
    const cy = Math.cos(E.yaw),
      sy = Math.sin(E.yaw);
    E.x += -cy * dx * sc + (-sy * dy * sc) / Math.sin(E.pitch);
    E.z += sy * dx * sc + (-cy * dy * sc) / Math.sin(E.pitch);
    const l = Math.hypot(E.x, E.z);
    if (l > 42) {
      E.x *= 42 / l;
      E.z *= 42 / l;
    }
  }
  private exploreGoal(pos: THREE.Vector3, look: THREE.Vector3) {
    const E = this.explore!;
    const cp = Math.cos(E.pitch);
    look.set(E.x, 0, E.z);
    pos.set(E.x + Math.sin(E.yaw) * cp * E.dist, Math.sin(E.pitch) * E.dist, E.z + Math.cos(E.yaw) * cp * E.dist);
  }

  private sunScreen() {
    this.tmp.set(0, 0, 0).project(this.camera);
    let x = (this.tmp.x * 0.5 + 0.5) * innerWidth,
      y = (-this.tmp.y * 0.5 + 0.5) * innerHeight;
    if (this.tmp.z > 1) {
      x = innerWidth - 60;
      y = 36;
    }
    return { x: Math.min(innerWidth, Math.max(0, x)), y: Math.min(innerHeight, Math.max(0, y)) };
  }

  scrollToSection(i: number) {
    window.scrollTo({ top: i * innerHeight, behavior: this.o.reduce ? 'auto' : 'smooth' });
  }

  private resize = () => {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();
    (this.bgStars.material as THREE.ShaderMaterial).uniforms.uScale.value = (h / 2) * this.renderer.getPixelRatio();
    this.placeSagittarius();
  };

  private fov = 48;
  private baseFov() {
    return innerWidth < 900 ? 64 : 48;
  }

  private mobile() {
    return innerWidth < 900;
  }

  /** Menüden bir bölüme gidince kamera ara bölümlerden geçmeden, yay çizerek doğrudan uçar. */
  flyTo(i: number, done?: () => void) {
    if (this.o.reduce) {
      done?.();
      return;
    }
    this.keyframe(i, this.B.pos, this.B.look);
    const dur = 1.5 + Math.min(1.1, this.cam.pos.distanceTo(this.B.pos) / 45);
    this.flight = { t: 0, dur, to: i, from: this.cam.pos.clone(), fromLook: this.cam.look.clone(), done };
  }

  /** Her bölüm için kameranın durduğu yer ve baktığı nokta. */
  private keyframe(i: number, pos: THREE.Vector3, look: THREE.Vector3) {
    const m = this.mobile();
    if (i <= 0) {
      // karşılama: galaksi ekranın sağ üstünde durur, sol alt yazıya kalır
      pos.set(m ? 0 : -7.5, m ? 27 : 15.5, m ? 44 : 33);
      look.set(m ? 0 : -7.5, m ? -11 : -6, 0);
      return;
    }
    if (i === 3) {
      pos.set(m ? 0 : -7, m ? 58 : 38, m ? 12 : 17);
      look.set(m ? 0 : -7, 0, m ? -7 : 1);
      return;
    }
    // Gezegen bölümleri: kamera gezegenle birlikte döner ve yörüngeye teğet bakar.
    // Böylece güneş hep gezegenin dış yanında kalır, panelin arkasına girip görüntüyü bozmaz.
    const b = i === 1 ? this.about : i === 2 ? this.growth : this.contact;
    const P = b.holder.getWorldPosition(this.tmp);
    const s = b.opts.size * (i === 4 ? 1.8 : i === 1 ? 1.35 : 1.25);
    const side = 1; // gezegen ekranın sağında durur (kartlar solda)
    const r = this.kr.set(P.x, 0, P.z).normalize();
    const f = this.kf.set(-r.z, 0, r.x).multiplyScalar(side); // bakış yönü
    if (m) {
      // telefonda kart alttadır: gezegen ekranın üst üçte birinde durur
      pos.copy(P).addScaledVector(f, -s * 9);
      pos.y += s * 2;
      look.copy(P).addScaledVector(r, s * 1.3); // hafifçe dışa bak: güneş kenardan yarım görünmesin
      look.y -= s * 3;
    } else {
      pos.copy(P).addScaledVector(f, -s * 6.2);
      pos.y += s * 1.5;
      look.copy(P).addScaledVector(r, s * 2.1);
      look.y += i === 1 ? s * 0.5 : s * 0.15;
    }
  }
  private kr = new THREE.Vector3();
  private kf = new THREE.Vector3();

  get inspecting() {
    return this.insp?.b ?? null;
  }

  /** Bir gezegeni yakından incele (null: çık). Kamera yumuşakça yanına gider; sürükleyince çevresinde döner. */
  inspect(b: PlanetBody | null) {
    if (!b) {
      if (!this.insp) return;
      this.insp = null;
      this.pinned = null;
      this.o.onInspect(null, -1, this.bodies.length);
      return;
    }
    const P = b.holder.getWorldPosition(this.tmp);
    // kameranın şu an durduğu yönden başla: görüntü savrulmaz, sadece yaklaşır
    const dx = this.cam.pos.x - P.x,
      dz = this.cam.pos.z - P.z;
    this.insp = { b, az: Math.atan2(dx, dz), el: 0.28, zoom: 1 };
    this.pinned = b;
    this.o.onInspect(b, this.bodies.indexOf(b), this.bodies.length);
  }

  /** İncelemede sıradaki (ya da önceki) gezegene geç. */
  inspectStep(d: number) {
    if (!this.insp) return;
    const n = this.bodies.length;
    this.inspect(this.bodies[(this.bodies.indexOf(this.insp.b) + d + n) % n]);
  }

  /** İncelenen gezegenin tıklama animasyonunu oynat. */
  pokeInspected() {
    this.insp?.b.character?.poke();
  }

  private inspectGoal(pos: THREE.Vector3, look: THREE.Vector3) {
    const I = this.insp!;
    const P = I.b.holder.getWorldPosition(this.tmp);
    const R = I.b.opts.size;
    const m = this.mobile();
    const dist = R * (m ? 7.6 : 6.3) * I.zoom;
    const ce = Math.cos(I.el);
    pos.set(P.x + Math.sin(I.az) * ce * dist, P.y + Math.sin(I.el) * dist, P.z + Math.cos(I.az) * ce * dist);
    look.copy(P);
    // bilgi kartına yer aç: masaüstünde gezegen sola, telefonda yukarı kayar
    const shift = R * I.zoom;
    if (m) look.y -= shift * 1.5;
    else {
      look.x += Math.cos(I.az) * shift * 1.25;
      look.z -= Math.sin(I.az) * shift * 1.25;
      look.y += shift * 0.1;
    }
  }

  /** İnceleme hareketleri: sürükle = çevir, tekerlek ya da iki parmak = yakınlaş. */
  private bindInspect(canvas: HTMLElement) {
    const dist2 = () => {
      const [a, b] = [...this.touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.insp && !this.explore) return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.drag = {
        x: e.clientX,
        y: e.clientY,
        x0: e.clientX,
        y0: e.clientY,
        pinch: this.touches.size === 2 ? dist2() : 0,
      };
      this.dragged = false;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const I = this.insp,
        D = this.drag;
      if ((!I && !this.explore) || !D || !this.touches.has(e.pointerId)) return;
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) {
        const d = dist2();
        if (D.pinch) this.exploreZoom(D.pinch / d);
        D.pinch = d;
        this.dragged = true;
        return;
      }
      const dx = e.clientX - D.x,
        dy = e.clientY - D.y;
      D.x = e.clientX;
      D.y = e.clientY;
      // Dokunuş mu, sürükleme mi? Başlangıç noktasından uzaklığa bakılır (toplam titreşime değil):
      // parmak dokunurken birkaç piksel oynar, bu bir sürükleme sayılmamalı.
      if (Math.hypot(e.clientX - D.x0, e.clientY - D.y0) > (e.pointerType === 'mouse' ? 6 : 14)) this.dragged = true;
      if (!I) {
        this.explorePan(dx, dy);
        return;
      }
      I.az -= dx * 0.0065;
      I.el = Math.min(1.25, Math.max(-0.45, I.el + dy * 0.005));
    });
    const up = (e: PointerEvent) => {
      this.touches.delete(e.pointerId);
      if (!this.touches.size) this.drag = null;
      else if (this.drag) {
        const t = [...this.touches.values()][0];
        this.drag.x = t.x;
        this.drag.y = t.y;
        this.drag.pinch = 0;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!this.insp && !this.explore) return;
        e.preventDefault();
        this.exploreZoom(Math.exp(e.deltaY * 0.0012));
      },
      { passive: false },
    );
  }

  private pick(): PlanetBody | null {
    this.ray.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera);
    const hit = this.ray.intersectObjects(
      this.bodies.map((b) => b.mesh),
      false,
    )[0];
    return (hit?.object.userData.body as PlanetBody) ?? null;
  }

  /** Ekranda (x, y) noktasına en yakın yazı yıldızı; `tol` piksel içinde değilse null. */
  private pickStar(x: number, y: number, tol: number) {
    let best: { b: PlanetBody; j: number } | null = null,
      bd = tol;
    for (const b of this.bodies) {
      for (let j = 0; j < b.stars.length; j++) {
        b.stars[j].getWorldPosition(this.tmp).project(this.camera);
        if (this.tmp.z > 1) continue;
        const d = Math.hypot((this.tmp.x * 0.5 + 0.5) * innerWidth - x, (-this.tmp.y * 0.5 + 0.5) * innerHeight - y);
        if (d < bd) {
          bd = d;
          best = { b, j };
        }
      }
    }
    return best;
  }

  /** Parmakla dokunuşta gezegeni tam tutturmak zor: yakınına dokunmak da sayılır. */
  private pickNear(x: number, y: number, tol: number) {
    let best: PlanetBody | null = null,
      bd = tol;
    for (const b of this.bodies) {
      b.holder.getWorldPosition(this.tmp).project(this.camera);
      if (this.tmp.z > 1) continue;
      const d = Math.hypot((this.tmp.x * 0.5 + 0.5) * innerWidth - x, (-this.tmp.y * 0.5 + 0.5) * innerHeight - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private onClick = (e: MouseEvent) => {
    if (document.documentElement.classList.contains('reading')) return;
    if (
      (e.target as HTMLElement).closest(
        '.panel, .top, .drawer, .cta, .skyhead, .scope, .buddy, .bubble, .hud, .reader, .pagebar, a, button',
      )
    )
      return;
    if (this.dragged) {
      // sürükleme bitti: bu bir tıklama değil
      this.dragged = false;
      return;
    }
    if (this.scopeOn) return;
    // gezegenin adına tıklamak da gezegeni açar
    const lb = (e.target as HTMLElement).closest('.planet-label');
    if (lb) {
      const named = this.bodies.find((x) => x.label === lb);
      if (named && this.insp?.b !== named) this.inspect(named);
      return;
    }
    this.pointer.x = (e.clientX / innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    if (!this.insp && !this.explore && this.sgrHit(e.clientX, e.clientY)) {
      this.celebrate();
      return;
    }
    this.ray.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera);
    if (this.ufo.hit(this.ray)) {
      this.ufo.zipAway();
      return;
    }
    if (this.alien.near(e.clientX, e.clientY, this.camera, 46)) {
      this.alien.scare();
      return;
    }
    const direct = this.pick() ?? this.pickNear(e.clientX, e.clientY, this.coarse ? 48 : 20);
    let st = this.pickStar(e.clientX, e.clientY, this.coarse ? 26 : 16);
    // uzaktan bakarken yıldızlar gezegene çok yakın durur: gezegen henüz açık değilse yıldız için tam isabet gerekir
    if (st && direct && this.insp?.b !== st.b) st = this.pickStar(e.clientX, e.clientY, 9);
    if (st) {
      this.o.onStar(st.b, st.j);
      return;
    }
    const b = direct;
    if (!b) {
      if (this.ray.intersectObject(this.sun, false).length) {
        // güneşe ya da kedi-aya dokunmak onu sadece canlandırır; tema yalnızca üstteki düğmeyle değişir
        (this.moonness > 0.5 ? this.cat : this.sunChar).poke();
      }
      return;
    }
    // gezegene dokunmak onu yakından açar; açıkken tekrar dokunmak canlandırır
    if (this.insp?.b === b) b.character?.poke();
    else this.inspect(b);
  };

  unpin() {
    if (!this.insp) this.pinned = null;
  }

  private sgrHit(x: number, y: number) {
    const b = this.sgrBox;
    return (
      !this.pointer.overUi && this.sgrVis > 0.5 && x > b.x0 - 24 && x < b.x1 + 24 && y > b.y0 - 24 && y < b.y1 + 24
    );
  }

  private lastParty = -10;
  /** Yay takımyıldızı: konfeti ve mesaj. */
  celebrate() {
    if (this.time - this.lastParty < 1.2) return;
    this.lastParty = this.time;
    const b = this.sgrBox;
    confetti(this.o.labels, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, this.o.reduce ? 0 : 80);
  }

  /**
   * Takımyıldızı gökyüzünde gerçek bir yerde durur (ekrana yapışık değil):
   * açılış görüntüsünün sağ üstüne denk gelecek yönde, uzakta. Kamera hareket edince doğal olarak kayar.
   */
  private placeSagittarius() {
    const m = this.mobile();
    const pos = new THREE.Vector3(),
      look = new THREE.Vector3();
    this.keyframe(0, pos, look);
    const fwd = look.sub(pos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const dir = fwd
      .clone()
      .addScaledVector(right, m ? -0.12 : 0.42)
      .addScaledVector(up, m ? 0.46 : 0.24)
      .normalize();
    const g = this.sgr.group;
    g.position.copy(pos).addScaledVector(dir, 150);
    g.lookAt(pos);
    g.scale.setScalar(m ? 0.5 : 0.6);
  }

  private smooth(e0: number, e1: number, x: number) {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  private A = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private B = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  private goal = { pos: new THREE.Vector3(), look: new THREE.Vector3() };

  private frame = () => {
    const now = performance.now();
    const raw = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(raw, 0.05);
    const reduce = this.o.reduce;
    this.tunePerf(raw);
    const spd = reduce ? 0 : 1;
    this.time += dt;

    const s = scrollY / innerHeight;
    const i = Math.floor(s),
      f = s - i,
      sec = Math.round(s);
    if (sec !== this.section) {
      this.section = sec;
      this.o.onSection(sec);
    }

    this.sunMat.uniforms.uTime.value = this.time;
    const su = (this.bgStars.material as THREE.ShaderMaterial).uniforms;
    su.uTime.value = reduce ? 0 : this.time;
    su.uNight.value = this.night;
    this.updateSun(dt);
    this.updateIntro(dt);
    this.night += (this.nightTarget - this.night) * (reduce ? 1 : Math.min(1, dt * 2.5));
    this.bodies.forEach((b) => (b.material.uniforms.uNight.value = this.night));
    this.moons.forEach((m) => ((m.material as THREE.ShaderMaterial).uniforms.uNight.value = this.night));
    this.world.rotation.y += dt * 0.005 * spd;
    this.bodies.forEach((b) => {
      b.pivot.rotation.y += b.opts.speed * dt * spd * (this.insp ? 0.12 : sec === 3 ? 0.35 : 1);
      b.mesh.rotation.y += dt * 0.18 * spd;
      b.material.uniforms.uTime.value = this.time;
      b.stars.forEach((st, j) => (st.rotation.y += dt * (1 + j * 0.2) * spd));
      if (b.ring) b.ring.rotation.z += dt * 0.05 * spd;
    });
    this.moons.forEach((m, j) => {
      const a = this.time * 0.4 * spd + j * 2.1;
      m.position.set(Math.cos(a) * 1.75, 0.3 + Math.sin(a * 2) * 0.2, Math.sin(a) * 1.75);
    });

    // kamera: iki bölümün arasında yumuşak geçiş + fareye göre hafif paralaks
    this.keyframe(i, this.A.pos, this.A.look);
    this.keyframe(Math.min(i + 1, 4), this.B.pos, this.B.look);
    const e = this.smooth(0.12, 0.88, f);
    this.goal.pos.lerpVectors(this.A.pos, this.B.pos, e);
    this.goal.look.lerpVectors(this.A.look, this.B.look, e);
    if (this.scopeOn) this.scopeGoal(this.goal.pos, this.goal.look);
    else if (this.insp) this.inspectGoal(this.goal.pos, this.goal.look);
    else if (this.explore) this.exploreGoal(this.goal.pos, this.goal.look);
    else if (!reduce && this.pointer.active) {
      this.goal.pos.x += this.pointer.x * 0.8;
      this.goal.pos.y += this.pointer.y * 0.5;
    }
    const k = reduce ? 1 : 1 - Math.pow(0.0015, dt);
    if (this.flight) {
      const F = this.flight;
      F.t += dt;
      const u = this.ease(F.t / F.dur);
      this.keyframe(F.to, this.B.pos, this.B.look);
      // yükselerek giden bir yay: başlangıç ve hedefin ortası, yukarı ve geriye çekilir
      const mid = this.tmp.lerpVectors(F.from, this.B.pos, 0.5);
      const dist = F.from.distanceTo(this.B.pos);
      mid.y += dist * 0.45 + 4;
      mid.multiplyScalar(1.12);
      const a = (1 - u) * (1 - u),
        b = 2 * (1 - u) * u,
        c = u * u;
      this.cam.pos.set(
        a * F.from.x + b * mid.x + c * this.B.pos.x,
        a * F.from.y + b * mid.y + c * this.B.pos.y,
        a * F.from.z + b * mid.z + c * this.B.pos.z,
      );
      this.cam.look.lerpVectors(F.fromLook, this.B.look, this.ease(Math.min(1, F.t / (F.dur * 0.8))));
      if (F.t >= F.dur) {
        this.flight = null;
        F.done?.();
      }
    } else {
      // incelemede biraz daha ağır ve yumuşak: yaklaşma ve dönüş süzülür gibi olur
      const slow = (this.insp || this.scopeOn || this.explore) && !reduce;
      const kk = slow ? 1 - Math.pow(this.scopeOn ? 0.03 : 0.012, dt) : k;
      this.cam.pos.lerp(this.goal.pos, kk);
      this.cam.look.lerp(this.goal.look, slow ? 1 - Math.pow(0.004, dt) : k);
    }
    if (this.debug) {
      this.cam.pos.copy(this.debug.pos);
      this.cam.look.copy(this.debug.look);
    }
    // teleskopta görüş açısı daralır (yakınlaştırma)
    const fovT = this.scopeOn ? SCOPE_FOV : this.baseFov();
    if (Math.abs(this.fov - fovT) > 0.01) {
      this.fov += (fovT - this.fov) * (reduce ? 1 : 1 - Math.pow(0.002, dt));
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.dust.update(this.night, this.time, this.camera, this.renderer.getPixelRatio());
    this.camera.position.copy(this.cam.pos);
    this.camera.lookAt(this.cam.look);
    this.camera.updateMatrixWorld();

    // üzerine gelme (bir yazı açıkken arkadaki galaksi hiçbir şeye tepki vermez)
    if (document.documentElement.classList.contains('reading') || this.pointer.overUi) {
      if (this.hoveredAny || this.hoverStar || this.hoverUfo || this.hoverSun || this.hoverCat || this.sgrHover) {
        this.hoverStar = null;
        this.hovered = null;
        this.hoveredAny = null;
        this.hoverUfo = this.hoverSun = this.hoverCat = this.sgrHover = false;
      }
      if (document.body.style.cursor) document.body.style.cursor = '';
    } else if (this.pointer.active && this.time - this.lastPick > 0.06 && !this.scopeOn && !this.drag) {
      this.lastPick = this.time;
      this.hoverStar = this.coarse ? null : this.pickStar(this.pointer.px, this.pointer.py, 16);
      const hb = this.hoverStar?.b ?? this.pick();
      this.hovered = hb && hb.opts.posts?.length ? hb : null;
      this.hoveredAny = hb;
      this.ray.setFromCamera(new THREE.Vector2(this.pointer.x, this.pointer.y), this.camera);
      this.hoverUfo = this.ufo.hit(this.ray);
      const center = !hb && !this.hoverUfo && this.ray.intersectObject(this.sun, false).length > 0;
      this.hoverCat = center && this.moonness > 0.5;
      this.hoverSun = center && !this.hoverCat;
      const sh = this.sgrHit(this.pointer.px, this.pointer.py);
      this.sgrHover = sh;
      document.body.style.cursor =
        hb || this.hoverSun || this.hoverCat || this.hoverUfo || sh
          ? 'pointer'
          : this.explore && !this.insp
            ? this.drag
              ? 'grabbing'
              : 'grab'
            : '';
    }
    const active = this.pinned ?? this.hovered;
    this.bodies.forEach((b) => animateConnections(b, b === active ? 1 : 0, dt, reduce));
    // incelemede yazı yıldızları küçük kalır: kameraya yakın geçerken gezegenin önünü kapatmasın
    this.insp?.b.stars.forEach((st) => st.scale.setScalar(0.6 * (st.userData.k as number)));
    if (this.hoverStar) this.hoverStar.b.stars[this.hoverStar.j].scale.multiplyScalar(1.9);
    this.bodies.forEach(syncStars);
    if (this.insp?.b.spokes) (this.insp.b.spokes.material as THREE.LineBasicMaterial).opacity = 0;
    if (this.insp?.b.chain) (this.insp.b.chain.material as THREE.LineBasicMaterial).opacity *= 0.4;
    this.updateTip(active);

    // Yay takımyıldızı: Hakkımda paneli sağdayken (ve mobilde gökyüzü başlığı varken) gizlenir
    const hideSgr = !!this.scopeOn || !!this.insp || this.intro >= 0 || this.introHold;
    this.sgrVis += ((hideSgr ? 0 : 1) - this.sgrVis) * Math.min(1, dt * 3);
    drawConstellation(this.sgr, hideSgr ? 0 : 1, dt);
    // sade: ince çizgiler, küçük yıldızlar; üzerine gelince biraz belirginleşir
    this.sgrGlow += ((this.sgrHover ? 1 : 0) - this.sgrGlow) * Math.min(1, dt * 4);
    const g = this.sgrGlow;
    (this.sgr.stars.material as THREE.PointsMaterial).size = 0.95 + g * 0.45;
    (this.sgr.stars.material as THREE.PointsMaterial).opacity = this.sgrVis * (0.55 + g * 0.45);
    (this.sgr.lines.material as THREE.LineBasicMaterial).opacity = this.sgrVis * (0.16 + g * 0.45);
    this.updateSgrBox();

    this.ufo.update(dt, this.time, this.camera, reduce, !!this.scopeOn || this.intro >= 0 || this.introHold);
    if (this.pointer.active && !this.coarse) this.ufo.shy(this.pointer.px, this.pointer.py, this.camera);
    this.alien.update(dt, this.time, this.camera, {
      bodies: this.bodies,
      px: this.pointer.active && !this.coarse ? this.pointer.px : -999,
      py: this.pointer.py,
      avoid: this.insp?.b ?? (this.scopeOn ? this.bodies[this.scopeIdx] : null),
      hidden: reduce || this.intro >= 0 || this.introHold || !!this.flight,
      night: this.night,
    });
    this.meteors.update(dt, this.camera, this.night, reduce || this.introHold || this.intro >= 0);
    this.updateCharacters(dt, reduce);
    this.updateLabels(sec);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.clear();
    // açılış perdesi kapalıyken (galaksi henüz doğmadı) boşuna çizme: açılış animasyonu akıcı kalsın
    if (!this.introHold || this.holdFrames++ < 4) this.renderer.render(this.scene, this.camera);
  };

  /** Zayıf cihazlarda kare süresi uzarsa çözünürlüğü kademeli düşürür; akıcılık keskinlikten önce gelir. */
  private perf = { n: 0, acc: 0 };
  private tunePerf(raw: number) {
    if (this.time < 5 || document.hidden || raw > 0.25) return;
    const p = this.perf;
    p.acc += raw;
    if (++p.n < 90) return;
    const avg = p.acc / p.n;
    p.n = p.acc = 0;
    const dpr = this.renderer.getPixelRatio();
    if (avg > 0.024 && dpr > 1) {
      this.renderer.setPixelRatio(Math.max(1, dpr - 0.5));
      this.resize();
    }
  }

  private updateSun(dt: number) {
    const c = this.corona.material as THREE.SpriteMaterial;
    let spin = 0.04,
      pulse = 0;
    if (this.morph) {
      const M = this.morph;
      M.t += dt;
      const u = Math.min(1, M.t / 1.7);
      const to = M.next === 'night' ? 1 : 0;
      this.moonness = M.from + (to - M.from) * this.smooth(0.2, 0.8, u);
      pulse = Math.sin(u * Math.PI);
      spin = 0.04 + pulse * 7; // dönüşürken hızla döner
      if (!M.waved && u > 0.32) {
        M.waved = true;
        const pt = this.sunScreen();
        this.o.onWave(pt.x, pt.y, M.next);
      }
      if (u >= 1) this.morph = null;
    }
    // güneş hızla dönüp küçülür, yerine kedi-ay zıplayarak gelir (ya da tersi)
    let sunVis = 1 - this.moonness,
      catVis = this.moonness;
    if (this.morph) {
      const u = Math.min(1, this.morph.t / 1.7);
      const out = 1 - this.smooth(0.05, 0.48, u);
      const inn = elastic(this.smooth(0.42, 1, u));
      sunVis = this.morph.next === 'night' ? out : inn;
      catVis = this.morph.next === 'night' ? inn : out;
    }
    this.catVis = catVis;
    this.sunVis = sunVis;
    this.sunSpin = spin;
    this.sunPulse = pulse;
    this.sunMat.uniforms.uMoon.value = 0;
    const mo = this.moonness;
    c.color.setRGB(1 - mo * 0.22, 0.82 - mo * 0.0, 0.54 + mo * 0.46);
    const base = 0.34 + mo * 0.06;
    c.opacity += (base + pulse * 0.4 - c.opacity) * Math.min(1, dt * 6);
    this.corona.scale.setScalar((8 - mo * 1.5) * (1 + pulse * 0.35) + Math.sin(this.time * 1.5) * 0.2);
  }

  /** Kodla kurulu karakterler: gezegenler, güneş ve kedi-ay. */
  private updateCharacters(dt: number, reduce: boolean) {
    const cs = this.charState;
    cs.dt = dt;
    cs.t = this.time;
    cs.night = this.night;
    cs.reduce = reduce;
    cs.camera = this.camera;
    const k = 1 - Math.exp(-6 * dt);
    // karakterler yüzlerini kameraya döner (yukarıdan bakışın yarısı kadar eğilerek)
    const cam = this.camera.position;
    const face = (o: THREE.Object3D) => {
      o.parent!.getWorldPosition(this.tmp);
      o.lookAt(this.tmp2.set(cam.x, this.tmp.y + (cam.y - this.tmp.y) * 0.5, cam.z));
    };
    this.bodies.forEach((b) => {
      if (!b.character) return;
      // ekranda olmayan karakter canlandırılmaz (teleskop açıkken hepsi canlı kalır)
      if (!this.scopeOn) {
        b.holder.getWorldPosition(this.tmp).project(this.camera);
        if (this.tmp.z > 1 || Math.abs(this.tmp.x) > 1.4 || Math.abs(this.tmp.y) > 1.4) return;
      }
      if (b !== this.insp?.b) face(b.charWrap!); // incelenen gezegen dönmez: çevresinde biz döneriz
      b.charHover += ((b === this.hoveredAny || b === this.pinned ? 1 : 0) - b.charHover) * k;
      cs.hover = b.charHover;
      try {
        b.character.update(cs);
      } catch (e) {
        // bozuk karakter: kaldır, yerine eski küre görünsün
        console.error(`karakter durdu: ${b.opts.char}`, e);
        b.charWrap?.removeFromParent();
        b.character = undefined;
        b.material.visible = true;
        b.mesh.scale.setScalar(1);
      }
    });
    this.sunHover += ((this.hoverSun ? 1 : 0) - this.sunHover) * k;
    this.catHover += ((this.hoverCat ? 1 : 0) - this.catHover) * k;
    const sg = this.sunWrap;
    sg.visible = this.sunVis > 0.01;
    if (sg.visible) {
      // dönüşürken hızla döner ve küçülür
      face(sg);
      if (this.morph) this.sunRoll += dt * this.sunSpin * 0.6;
      else this.sunRoll += (Math.round(this.sunRoll / (Math.PI * 2)) * Math.PI * 2 - this.sunRoll) * k;
      sg.rotateZ(this.sunRoll);
      sg.scale.setScalar(1.7 * Math.max(0.001, this.sunVis) * (1 - this.sunPulse * 0.12));
      cs.hover = this.sunHover;
      this.sunChar.update(cs);
    }
    const cg = this.catWrap;
    cg.visible = this.catVis > 0.01;
    if (cg.visible) {
      face(cg);
      cg.scale.setScalar(1.65 * Math.max(0.001, this.catVis));
      cs.hover = this.catHover;
      this.cat.update(cs);
    }
  }

  /** Big Bang: tek bir ışık noktası patlar, galaksi merkezden dışarı açılır. */
  bigBang() {
    this.introHold = false;
    this.intro = this.o.reduce ? -1 : 0;
    if (this.o.reduce) this.endIntro();
  }

  /** Açılışı beklemeden galaksiyi hemen normal hâline getirir. */
  endIntro() {
    this.introHold = false;
    this.intro = -1;
    this.world.scale.setScalar(1);
    this.bgStars.scale.setScalar(1);
    (this.flash.material as THREE.SpriteMaterial).opacity = 0;
    (this.shock.material as THREE.MeshBasicMaterial).opacity = 0;
  }

  /** Güneşin (galaksi merkezinin) ekrandaki konumu, piksel olarak. */
  sunPoint() {
    return this.sunScreen();
  }

  /** Açılış: tek bir ışık noktası patlar, galaksi merkezden dışarı açılır. */
  private updateIntro(dt: number) {
    if (this.introHold) {
      // patlamadan önce: evren henüz tek bir nokta
      this.world.scale.setScalar(0.001);
      this.bgStars.scale.setScalar(0.15);
      return;
    }
    if (this.intro < 0) return;
    this.intro += dt;
    const u = Math.min(1, this.intro / 3.4);
    const e = 1 - Math.pow(1 - u, 4);
    this.world.scale.setScalar(Math.max(0.001, e));
    this.bgStars.scale.setScalar(0.15 + 0.85 * (1 - Math.pow(1 - u, 2)));
    this.bodies.forEach((b) => (b.pivot.rotation.y += dt * (1 - e) * 5));
    const f = this.flash.material as THREE.SpriteMaterial;
    const fl = Math.min(1, this.intro / 0.25) * Math.max(0, 1 - this.intro / 1.3);
    f.opacity = fl;
    this.flash.scale.setScalar(2 + this.intro * 60);
    const sh = this.shock.material as THREE.MeshBasicMaterial;
    const st = Math.max(0, this.intro - 0.15);
    sh.opacity = Math.max(0, 0.7 - st * 0.45);
    this.shock.scale.setScalar(0.5 + st * 26);
    if (u >= 1) {
      this.intro = -1;
      this.world.scale.setScalar(1);
      this.bgStars.scale.setScalar(1);
      f.opacity = 0;
      sh.opacity = 0;
    }
  }

  private ease(t: number) {
    t = Math.min(1, Math.max(0, t));
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private updateSgrBox() {
    const pos = this.sgr.stars.geometry.attributes.position as THREE.BufferAttribute;
    const b = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
    for (let i = 0; i < pos.count; i++) {
      this.tmp.fromBufferAttribute(pos, i);
      this.sgr.stars.localToWorld(this.tmp).project(this.camera);
      const x = (this.tmp.x * 0.5 + 0.5) * innerWidth,
        y = (-this.tmp.y * 0.5 + 0.5) * innerHeight;
      b.x0 = Math.min(b.x0, x);
      b.x1 = Math.max(b.x1, x);
      b.y0 = Math.min(b.y0, y);
      b.y1 = Math.max(b.y1, y);
    }
    this.sgrBox = b;
    this.sgrLabel.style.left = `${(b.x0 + b.x1) / 2}px`;
    this.sgrLabel.style.top = `${b.y1 + 14}px`;
    this.sgrLabel.style.opacity = String(this.sgrVis * this.sgrGlow);
  }

  private updateTip(b: PlanetBody | null) {
    if (this.hoverStar && !this.scopeOn) {
      const t = this.hoverStar.b.opts.posts?.[this.hoverStar.j] ?? '';
      this.tip.classList.add('on');
      this.tip.style.left = `${this.pointer.px + 20}px`;
      this.tip.style.top = `${this.pointer.py + 10}px`;
      if (this.tip.dataset.k !== 'st' + t) {
        this.tip.dataset.k = 'st' + t;
        this.tip.innerHTML = `<small>${this.hoverStar.b.opts.name} · ${L('yıldız')}</small><span>✦ ${L(t).replace(/</g, '&lt;')}</span><span>${L('Okumak için tıkla')}</span>`;
      }
      return;
    }
    if (this.pinned || this.insp) {
      // yazılar zaten yandaki çekmecede açık: aynı listeyi ikinci kez gösterme
      this.tip.classList.remove('on');
      return;
    }
    if (!b || b.hover < 0.5) {
      const msg =
        this.scopeOn || this.mobile()
          ? null
          : this.sgrHover
            ? [
                'sgr',
                '<small>Yay takımyıldızı ♐︎</small><span>Yay burcuyum, doğum günüm 25 Kasım 🎂</span><span>Tıkla, kutlayalım!</span>',
              ]
            : this.hoverUfo
              ? ['ufo', '<small>Kimliği belirsiz uçan cisim</small><span>👽 Yakalamak için tıkla!</span>']
              : this.hoverCat
                ? ['cat', '<small>Ay kedi ☾</small><span>Uyuyor... 🐾</span><span>Dokun, güneş doğsun</span>']
                : this.hoverSun
                  ? [
                      'sun',
                      this.theme === 'day'
                        ? '<small>Güneş</small><span>☀ Dokun, aya dönüşsün</span>'
                        : '<small>Ay</small><span>☾ Dokun, güneş doğsun</span>',
                    ]
                  : null;
      this.tip.classList.toggle('on', !!msg);
      if (msg) {
        this.tip.style.left = `${this.pointer.px + 22}px`;
        this.tip.style.top = `${this.pointer.py + 8}px`;
        if (this.tip.dataset.k !== msg[0] + this.theme) {
          this.tip.dataset.k = msg[0] + this.theme;
          this.tip.innerHTML = msg[1];
          translate(this.tip);
        }
      }
      return;
    }
    const on = !this.mobile() && !this.scopeOn;
    this.tip.classList.toggle('on', on);
    if (!on) return;
    b.holder.getWorldPosition(this.tmp).project(this.camera);
    this.tip.style.left = `${(this.tmp.x * 0.5 + 0.5) * innerWidth + 34}px`;
    this.tip.style.top = `${(-this.tmp.y * 0.5 + 0.5) * innerHeight}px`;
    if (this.tip.dataset.k !== b.opts.name) {
      this.tip.dataset.k = b.opts.name;
      const list = b.opts.posts ?? [];
      this.tip.innerHTML =
        `<small>${b.opts.name} · ${list.length} ${lang === 'en' ? (list.length === 1 ? 'star' : 'stars') : 'yıldız'}</small>` +
        list
          .slice(0, 5)
          .map((t) => `<span>✦ ${L(t).replace(/</g, '&lt;')}</span>`)
          .join('') +
        (list.length > 5
          ? `<span>${lang === 'en' ? `+ ${list.length - 5} more` : `+ ${list.length - 5} yazı daha`}</span>`
          : '');
    }
  }

  private topEls = [
    ...document.querySelectorAll<HTMLElement>(
      '.top .brand, .top .top-actions, .hud-top, .hud-bottom, .pagebar, .telescope, .np',
    ),
  ];
  private updateLabels(sec: number) {
    // önce yakındakiler: üst üste binen etiketlerden arkadaki gizlenir
    const items = this.bodies.map((b) => {
      b.holder.getWorldPosition(this.tmp);
      this.tmp.y -= b.opts.size * 1.45;
      this.tmp.project(this.camera);
      return {
        b,
        x: (this.tmp.x * 0.5 + 0.5) * innerWidth,
        y: (-this.tmp.y * 0.5 + 0.5) * innerHeight,
        z: this.tmp.z,
        nx: this.tmp.x,
        ny: this.tmp.y,
      };
    });
    items.sort((p, q) => p.z - q.z);
    const shown: { x0: number; x1: number; y0: number; y1: number }[] = [];
    // üst bardaki logo ve düğmelerin altına etiket girmesin
    for (const el of this.topEls) {
      const r = el.getBoundingClientRect();
      if (r.width) shown.push({ x0: r.left - 8, x1: r.right + 8, y0: r.top - 30, y1: r.bottom + 6 });
    }
    for (const it of items) {
      const b = it.b;
      let vis = it.z < 1 && Math.abs(it.nx) < 1.05 && Math.abs(it.ny) < 1.05 && b.hover < 0.5 && !this.flight;
      if (b.opts.key === 'topic' && sec !== 3 && sec !== 0 && !this.explore) vis = false;
      if (this.scopeOn || this.insp || (b.opts.key === 'about' && sec === 1 && !this.explore)) vis = false;
      if (vis) {
        const w = (b.label.offsetWidth || 80) / 2 + 4;
        const box = { x0: it.x - w, x1: it.x + w, y0: it.y - 2, y1: it.y + 26 };
        const a = this.explore ? undefined : this.avoid[sec];
        if (a && box.x0 < a.right + 12 && box.x1 > a.left - 12 && box.y0 < a.bottom + 34 && box.y1 > a.top - 30)
          vis = false;
        else if (shown.some((o) => box.x0 < o.x1 && box.x1 > o.x0 && box.y0 < o.y1 && box.y1 > o.y0)) vis = false;
        else shown.push(box);
      }
      b.label.style.opacity = vis ? '1' : '0';
      b.label.classList.toggle('on', vis);
      if (vis) {
        b.label.style.left = `${it.x}px`;
        b.label.style.top = `${it.y}px`;
      }
    }
  }
}

/** Hedefi biraz aşıp geri yaylanan kolaylaştırma (0→1). */
function elastic(x: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  return Math.pow(2, -9 * x) * Math.sin(((x * 10 - 0.75) * 2 * Math.PI) / 3) + 1;
}

/** Karakteri kurar; hata verirse görünmez boş bir karakterle devam eder. */
function safeChar(key: string): Character {
  try {
    return CHARACTERS[key]();
  } catch (e) {
    console.error(`karakter kurulamadı: ${key}`, e);
    return { group: new THREE.Group(), update: () => {}, poke: () => {} };
  }
}
