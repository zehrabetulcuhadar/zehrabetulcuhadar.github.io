import * as THREE from 'three';
import { clay } from './characters/kit';

/**
 * Ara sıra ekranın önünden süzülüp geçen küçük uzay gemisi ve içindeki uzaylı.
 * Tıklanınca bir takla atıp hızla uzaklaşır.
 */
export class Ufo {
  group = new THREE.Group();
  private lights: THREE.Mesh[] = [];
  private alien = new THREE.Group();
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private up = new THREE.Vector3();
  private t = -1;
  private wait = 9;
  private zip = -1;
  private zipFrom = new THREE.Vector3();
  private zipDir = new THREE.Vector3();
  private dur = 10;
  onSpotted?: () => void;

  constructor(scene: THREE.Scene) {
    // kilden bir daire tabak: yumuşak, tombul profil (torna ile döndürülmüş)
    const prof = [
      [0, -0.3],
      [0.3, -0.29],
      [0.62, -0.2],
      [0.98, -0.07],
      [1.12, 0],
      [1.08, 0.07],
      [0.8, 0.15],
      [0.52, 0.22],
      [0, 0.24],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const curve = new THREE.SplineCurve(prof);
    const hull = new THREE.Mesh(new THREE.LatheGeometry(curve.getPoints(28), 56), clay('#B9A6F0', { emissive: 0.12 }));
    // kenar boyunca pembe kuşak
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.085, 14, 64), clay('#F28AC0', { emissive: 0.14 }));
    band.rotation.x = Math.PI / 2;
    band.scale.z = 0.75;
    // alttaki ışıklı göbek
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.44, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      clay('#7FE3D2', { emissive: 0.75 }),
    );
    belly.position.y = -0.2;
    belly.scale.y = 0.6;
    // çekim ışını: aşağı doğru açılan yumuşak koni
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.95, 1.7, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#BFF7EC',
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.beam.position.y = -1.1;
    // cam kubbe ve üzerindeki parlama
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({
        color: '#D8F6FF',
        transparent: true,
        opacity: 0.3,
        roughness: 0.08,
        depthWrite: false,
      }),
    );
    dome.position.y = 0.2;
    dome.scale.y = 1.1;
    dome.renderOrder = 2;
    const shine = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false }),
    );
    shine.scale.set(1.6, 0.7, 0.4);
    shine.position.set(-0.26, 0.62, 0.36);
    shine.rotation.z = 0.6;
    shine.renderOrder = 3;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 10, 48), clay('#FFF4E6'));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.21;

    // pilot: iri gözlü, yanakları pembe küçük uzaylı
    const skin = clay('#9EE0A2', { emissive: 0.16 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 16), skin);
    head.scale.set(1.15, 0.95, 1);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#241a33' });
    const white = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    [-1, 1].forEach((s) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), eyeMat);
      eye.scale.set(0.85, 1.2, 0.5);
      eye.position.set(s * 0.115, 0.02, 0.235);
      eye.rotation.z = -s * 0.3;
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), white);
      sh.position.set(s * 0.115 + 0.025, 0.06, 0.285);
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 10, 6),
        new THREE.MeshBasicMaterial({ color: '#F28AC0', transparent: true, opacity: 0.6 }),
      );
      cheek.scale.set(1, 0.6, 0.3);
      cheek.position.set(s * 0.2, -0.08, 0.2);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.2, 6), skin);
      stalk.position.set(s * 0.11, 0.33, 0);
      stalk.rotation.z = -s * 0.4;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), clay('#F7C548', { emissive: 0.6 }));
      tip.position.set(s * 0.15, 0.43, 0);
      this.alien.add(eye, sh, cheek, stalk, tip);
    });
    this.alien.add(head);
    this.alien.position.y = 0.36;

    // kenarda sırayla yanıp sönen kil düğmeler
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const l = new THREE.Mesh(
        new THREE.SphereGeometry(0.085, 12, 8),
        new THREE.MeshBasicMaterial({ color: '#F5C45E' }),
      );
      l.position.set(Math.cos(a) * 0.8, 0.13, Math.sin(a) * 0.8);
      l.scale.y = 0.6;
      this.lights.push(l);
    }
    this.group.add(hull, band, belly, this.beam, collar, this.alien, dome, shine, ...this.lights);
    this.group.scale.setScalar(0.85);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** İmleç yaklaşırsa pilot telaşlanır ve gemi kaçar. */
  shy(px: number, py: number, camera: THREE.Camera) {
    if (this.t < 0 || this.zip >= 0 || this.t < 1.2) return;
    this.sv.copy(this.group.position).project(camera);
    const x = (this.sv.x * 0.5 + 0.5) * innerWidth,
      y = (-this.sv.y * 0.5 + 0.5) * innerHeight;
    if (Math.hypot(x - px, y - py) < 95) this.zipAway();
  }
  private sv = new THREE.Vector3();
  private beam!: THREE.Mesh;

  get flying() {
    return this.t >= 0 || this.zip >= 0;
  }

  private spawn(camera: THREE.PerspectiveCamera) {
    const fwd = new THREE.Vector3(),
      right = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    this.up.crossVectors(right, fwd).normalize();
    const d = 16;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
    const halfW = halfH * camera.aspect + 3;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const h1 = halfH * (0.15 + Math.random() * 0.5),
      h2 = halfH * (0.1 + Math.random() * 0.55);
    const base = camera.position.clone().addScaledVector(fwd, d);
    this.from
      .copy(base)
      .addScaledVector(right, -halfW * dir)
      .addScaledVector(this.up, h1);
    this.to
      .copy(base)
      .addScaledVector(right, halfW * dir)
      .addScaledVector(this.up, h2);
    this.dur = 9 + Math.random() * 4;
    this.t = 0;
    this.group.visible = true;
    this.onSpotted?.();
  }

  /** Tıklanınca: takla at ve kaç. */
  zipAway() {
    if (this.t < 0 || this.zip >= 0) return;
    this.zip = 0;
    this.zipFrom.copy(this.group.position);
    this.zipDir.copy(this.to).sub(this.from).normalize().addScaledVector(this.up, 1.2).normalize();
    this.t = -1;
  }

  update(dt: number, time: number, camera: THREE.PerspectiveCamera, reduce: boolean, paused: boolean) {
    if (reduce) return;
    this.lights.forEach((l, i) => {
      const on = (Math.floor(time * 5) + i) % 4 === 0;
      (l.material as THREE.MeshBasicMaterial).color.set(on ? '#FFF6D8' : '#F5B84E');
    });
    this.alien.rotation.y = Math.sin(time * 2.2) * 0.6;
    this.alien.position.y = 0.36 + (this.zip >= 0 ? -0.22 : Math.sin(time * 3) * 0.015); // kaçarken kubbenin içine siner
    (this.beam.material as THREE.MeshBasicMaterial).opacity = this.zip >= 0 ? 0 : 0.12 + Math.sin(time * 4) * 0.04;

    if (this.zip >= 0) {
      this.zip += dt;
      const k = this.zip / 0.9;
      this.group.position.copy(this.zipFrom).addScaledVector(this.zipDir, k * k * 40);
      this.group.rotation.z = k * Math.PI * 2;
      this.group.scale.setScalar(0.85 * Math.max(0.05, 1 - k * 0.7));
      if (k >= 1) {
        this.zip = -1;
        this.group.visible = false;
        this.group.scale.setScalar(0.85);
        this.group.rotation.z = 0;
        this.wait = 40 + Math.random() * 30;
      }
      return;
    }
    if (this.t < 0) {
      if (paused) return;
      this.wait -= dt;
      if (this.wait <= 0) this.spawn(camera);
      return;
    }
    this.t += dt;
    const k = this.t / this.dur;
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const ee = k * 0.35 + e * 0.65; // ortada biraz yavaşlar, "bakınır"
    this.group.position.lerpVectors(this.from, this.to, ee).addScaledVector(this.up, Math.sin(this.t * 2.4) * 0.35);
    this.group.rotation.y += dt * 1.6;
    this.group.rotation.z = Math.sin(this.t * 1.7) * 0.18;
    this.group.rotation.x = 0.25;
    if (k >= 1) {
      this.t = -1;
      this.group.visible = false;
      this.wait = 22 + Math.random() * 22;
    }
  }

  hit(ray: THREE.Raycaster) {
    return this.group.visible && ray.intersectObject(this.group, true).length > 0;
  }
}
