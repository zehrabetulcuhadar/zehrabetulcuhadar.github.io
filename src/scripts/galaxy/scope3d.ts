import * as THREE from 'three';

/**
 * Gözlemevinin açılışı: kilden üç boyutlu bir teleskop.
 * 1) Teleskop, sayfadaki küçük teleskobun olduğu yerden büyüyerek ortaya gelir (yandan görünür).
 * 2) Ayağının üzerinde döner: göz merceği bize, objektifi gökyüzüne bakar.
 * 3) Kamera göz merceğine yaklaşır; camın içinden galaksi görünmeye başlar ve mercek ekranı doldurur.
 * Gerçek bir 3B model olduğu için dönüş ve yaklaşma fiziksel olarak tutarlıdır.
 */
export interface ScopeIntroOptions {
  /** Sayfadaki teleskop düğmesinin ekrandaki merkezi. */
  from: { x: number; y: number };
  /** Merceğin ekranda oturacağı yer ve yarıçapı. */
  lens: { x: number; y: number; r: number };
  night: boolean;
  /** Göz merceğinin camı ekranda nerede ve ne kadar büyük (perdede delik oraya açılır). */
  onIris: (x: number, y: number, r: number) => void;
  /** Cam saydamlaşmaya başladı: galaksi artık mercekten görünüyor. */
  onLook: () => void;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const FOV = 35;
const GLASS_R = 0.17;
const EYE_Z = 1.72;

export class ScopeIntro {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60);
  private root = new THREE.Group();
  private aim = new THREE.Group();
  private tilt = new THREE.Group();
  private glass: THREE.Mesh;
  private mats: Record<string, THREE.MeshStandardMaterial> = {};
  private raf = 0;
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight('#FFF6EE', '#B9A6D6', 1.5));
    const key = new THREE.DirectionalLight('#FFFFFF', 2.1);
    key.position.set(-4, 6, 8);
    this.scene.add(key);

    const mat = (name: string, color: string, rough = 0.8) =>
      (this.mats[name] = new THREE.MeshStandardMaterial({
        color,
        roughness: rough,
        emissive: color,
        emissiveIntensity: 0.08,
      }));
    const tube = mat('tube', '#E48AAE');
    const gold = mat('gold', '#E9B44C', 0.6);
    const ink = mat('ink', '#4A2A46');
    const rim = mat('rim', '#C4618A');
    const cyl = (r1: number, r2: number, len: number, z: number, m: THREE.Material, open = false) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 40, 1, open), m);
      c.rotation.x = Math.PI / 2; // eksen Z boyunca; r1 +Z ucunda
      c.position.z = z;
      return c;
    };
    const T = this.tilt;
    T.add(cyl(0.36, 0.36, 2.5, -0.25, tube)); // ana gövde
    T.add(cyl(0.45, 0.45, 0.52, -1.72, gold)); // güneşlik
    T.add(cyl(0.385, 0.385, 0.14, -0.95, gold));
    T.add(cyl(0.385, 0.385, 0.14, 0.62, gold));
    T.add(cyl(0.2, 0.36, 0.3, 1.15, tube)); // arkaya doğru incelen kısım
    T.add(cyl(0.2, 0.2, 0.44, 1.5, ink)); // göz merceğinin borusu
    const cup = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.034, 14, 48), rim);
    cup.position.z = EYE_Z;
    T.add(cup);
    // objektif camı (öndeki büyük mercek)
    const front = new THREE.Mesh(
      new THREE.CircleGeometry(0.41, 40),
      new THREE.MeshStandardMaterial({
        color: '#BFF3FF',
        roughness: 0.15,
        emissive: '#BFF3FF',
        emissiveIntensity: 0.25,
      }),
    );
    front.rotation.y = Math.PI;
    front.position.z = -1.9;
    T.add(front);
    // arayıcı dürbün
    const finder = cyl(0.085, 0.085, 0.95, -0.1, ink);
    finder.position.y = 0.52;
    T.add(finder);
    [-0.4, 0.2].forEach((z) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), ink);
      post.position.set(0, 0.42, z);
      T.add(post);
    });
    // göz merceğinin camı: önce koyu cam, yaklaşınca saydamlaşır
    this.glass = new THREE.Mesh(
      new THREE.CircleGeometry(GLASS_R, 48),
      new THREE.MeshBasicMaterial({ color: '#2A2140', transparent: true, opacity: 1, depthWrite: false }),
    );
    this.glass.position.z = EYE_Z + 0.012;
    this.glass.renderOrder = 5;
    T.add(this.glass);
    // "kapı": yalnızca derinlik yazar; arkasındaki boru çizilmez, tuval orada saydam kalır ve galaksi görünür
    const portal = new THREE.Mesh(
      new THREE.CircleGeometry(GLASS_R, 48),
      new THREE.MeshBasicMaterial({ colorWrite: false }),
    );
    portal.position.z = EYE_Z + 0.006;
    portal.renderOrder = -1;
    T.add(portal);

    this.aim.add(T);
    // çatal ve ayak
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 20), ink);
    yoke.position.y = -0.5;
    this.aim.add(yoke);
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), gold);
    hub.position.y = -0.74;
    this.root.add(hub);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const top = new THREE.Vector3(0, -0.74, 0),
        foot = new THREE.Vector3(Math.cos(a) * 1.25, -3.1, Math.sin(a) * 1.25);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, top.distanceTo(foot), 10), ink);
      leg.position.copy(top).add(foot).multiplyScalar(0.5);
      leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), foot.clone().sub(top).normalize());
      this.root.add(leg);
      const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), gold);
      shoe.position.copy(foot);
      this.root.add(shoe);
    }
    this.root.add(this.aim);
    this.scene.add(this.root);
  }

  private size() {
    const w = innerWidth,
      h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
  }

  /** Açılışı oynatır; bittiğinde (mercek ekrandaki yerine oturunca) çözülür. */
  play(o: ScopeIntroOptions) {
    cancelAnimationFrame(this.raf);
    this.size();
    const w = innerWidth,
      h = innerHeight;
    // mercek ekranın tam ortasında değil: görüş merkezini oraya kaydır
    this.camera.setViewOffset(w, h, w / 2 - o.lens.x, h / 2 - o.lens.y, w, h);
    this.camera.updateProjectionMatrix();
    this.mats.ink.color.set(o.night ? '#CFC6E6' : '#4A2A46');
    this.mats.ink.emissive.set(o.night ? '#CFC6E6' : '#4A2A46');
    this.mats.tube.color.set(o.night ? '#F7A8CF' : '#E48AAE');
    this.canvas.style.opacity = '1';

    const camA = new THREE.Vector3(0, -0.9, 11.5),
      lookA = new THREE.Vector3(0, -1.15, 0);
    // küçük teleskobun ekrandaki yerine denk gelen dünya noktası (z = 0 düzleminde)
    this.camera.position.copy(camA);
    this.camera.lookAt(lookA);
    this.camera.updateMatrixWorld();
    const ndc = new THREE.Vector3((o.from.x / w) * 2 - 1, -(o.from.y / h) * 2 + 1, 0.5).unproject(this.camera);
    const dir = ndc.sub(camA).normalize();
    const start = camA.clone().addScaledVector(dir, -camA.z / dir.z);
    start.y += 0.25;

    const yaw0 = -Math.PI / 2,
      pitch0 = 0.46,
      pitch1 = 0.1;
    const dEnd = (GLASS_R * h) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * o.lens.r);
    const DUR = 2150;
    const t0 = performance.now();
    let looked = false;
    const camB = new THREE.Vector3(),
      lookB = new THREE.Vector3(),
      look = new THREE.Vector3(),
      E = new THREE.Vector3(),
      A = new THREE.Vector3();

    return new Promise<void>((resolve) => {
      const frame = (now: number) => {
        const fixed = (window as unknown as { __scopeT?: number }).__scopeT; // geliştirme: zamanı dondurup kare kare bakmak için
        const t = fixed ?? Math.min(1, (now - t0) / DUR);
        // 1) gelir
        const a = ease(seg(t, 0, 0.3));
        this.root.position.lerpVectors(start, this.v.set(0, 0, 0), a);
        this.root.scale.setScalar(0.12 + 0.88 * a);
        // 2) döner ve yataya iner
        const b = ease(seg(t, 0.16, 0.62));
        this.aim.rotation.y = yaw0 * (1 - b) + Math.sin(b * Math.PI) * 0.06; // hafif bir aşma
        this.tilt.rotation.x = pitch0 + (pitch1 - pitch0) * b;
        this.root.updateMatrixWorld(true);
        // 3) kamera göz merceğine yaklaşır
        const c = ease(seg(t, 0.56, 1));
        E.set(0, 0, EYE_Z).applyMatrix4(this.tilt.matrixWorld);
        A.set(0, 0, 1).transformDirection(this.tilt.matrixWorld);
        camB.copy(E).addScaledVector(A, dEnd);
        lookB.copy(E).addScaledVector(A, -2);
        this.camera.position.lerpVectors(camA, camB, c);
        look.lerpVectors(lookA, lookB, Math.min(1, c * 1.6));
        this.camera.lookAt(look);
        this.camera.updateMatrixWorld();
        const g = seg(t, 0.66, 0.9);
        (this.glass.material as THREE.MeshBasicMaterial).opacity = 1 - g;
        if (g > 0) {
          if (!looked) {
            looked = true;
            o.onLook();
          }
          // camın ekrandaki yeri ve yarıçapı: perdede delik tam buraya açılır
          this.v.copy(E).project(this.camera);
          const ex = (this.v.x * 0.5 + 0.5) * w,
            ey = (-this.v.y * 0.5 + 0.5) * h;
          this.v2.set(0, GLASS_R, EYE_Z).applyMatrix4(this.tilt.matrixWorld).project(this.camera);
          const er = Math.hypot((this.v2.x * 0.5 + 0.5) * w - ex, (-this.v2.y * 0.5 + 0.5) * h - ey);
          o.onIris(ex, ey, er);
        }
        this.renderer.render(this.scene, this.camera);
        if (t < 1) this.raf = requestAnimationFrame(frame);
        else {
          o.onIris(o.lens.x, o.lens.y, o.lens.r);
          this.canvas.style.opacity = '0';
          resolve();
        }
      };
      this.raf = requestAnimationFrame(frame);
    });
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.canvas.style.opacity = '0';
  }
}
