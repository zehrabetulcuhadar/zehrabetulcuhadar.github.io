import * as THREE from 'three';
import type { PlanetBody } from './planets';
import { clay } from './characters/kit';

interface AlienFrame {
  bodies: PlanetBody[];
  /** İmlecin ekrandaki yeri (dokunmatik cihazda -999). */
  px: number;
  py: number;
  /** Şu an yakından bakılan gezegen: uzaylı orada durmaz. */
  avoid: PlanetBody | null;
  hidden: boolean;
  night: number;
}

/**
 * Utangaç uzaylı: bir gezegenin arkasından başını uzatıp ziyaretçiyi izler.
 * İmleç yaklaşınca (ya da dokununca) irkilir, gezegenin arkasına saklanır ve bir süre sonra
 * başka bir gezegenin arkasından yeniden bakar.
 */
export class Alien {
  group = new THREE.Group();
  private head = new THREE.Group();
  private lids: THREE.Mesh[] = [];
  private pupils: THREE.Mesh[] = [];
  private tips: THREE.Mesh[] = [];
  private hands: THREE.Mesh[] = [];
  private host: PlanetBody | null = null;
  private peek = 0;
  private want = 0;
  private wait = 6;
  private startle = -1;
  private blink = 3;
  private screen = { x: -999, y: -999 };
  private v = new THREE.Vector3();
  private v2 = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    const skin = clay('#9EE0A2', { emissive: 0.16 });
    const dark = new THREE.MeshBasicMaterial({ color: '#241a33' });
    const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const head = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin);
    head.scale.set(1.18, 0.92, 0.95);
    this.head.add(head);
    [-1, 1].forEach((sgn) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), dark);
      eye.scale.set(0.82, 1.15, 0.5);
      eye.position.set(sgn * 0.44, 0.05, 0.78);
      eye.rotation.z = -sgn * 0.3;
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), white);
      shine.position.set(sgn * 0.44 + 0.1, 0.2, 0.97);
      const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), white);
      shine2.position.set(sgn * 0.44 - 0.08, -0.06, 0.96);
      this.pupils.push(eye);
      // göz kapağı: irkilince açılır, kırpınca kapanır
      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin);
      lid.scale.set(0.86, 1.2, 0.6);
      lid.position.copy(eye.position);
      lid.rotation.z = eye.rotation.z;
      this.lids.push(lid);
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 8),
        new THREE.MeshBasicMaterial({ color: '#F28AC0', transparent: true, opacity: 0.55 }),
      );
      cheek.scale.set(1, 0.6, 0.3);
      cheek.position.set(sgn * 0.74, -0.3, 0.6);
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 8), skin);
      stalk.position.set(sgn * 0.42, 1.08, 0);
      stalk.rotation.z = -sgn * 0.4;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 10), clay('#F7C548', { emissive: 0.5 }));
      tip.position.set(sgn * 0.55, 1.4, 0);
      this.tips.push(tip);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), skin);
      hand.scale.set(1, 0.7, 0.8);
      hand.position.set(sgn * 0.95, -0.95, 0.5);
      this.hands.push(hand);
      this.head.add(eye, shine, shine2, lid, cheek, stalk, tip);
      this.group.add(hand);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.035, 8, 16, Math.PI), dark);
    mouth.position.set(0, -0.36, 0.9);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);
    this.group.add(this.head);
    this.group.visible = false;
    scene.add(this.group);
  }

  /** Ekranda (x, y) noktası uzaylıya `r` pikselden yakın mı? */
  near(x: number, y: number, _camera: THREE.Camera, r: number) {
    return this.group.visible && this.peek > 0.4 && Math.hypot(this.screen.x - x, this.screen.y - y) < r;
  }

  /** İrkil ve saklan. */
  scare() {
    if (this.startle >= 0 || this.want === 0) return;
    this.startle = 0;
  }

  private choose(f: AlienFrame, camera: THREE.Camera) {
    // ekranda rahat görünen, yakından bakılmayan gezegenlerden biri
    const ok = f.bodies.filter((b) => {
      if (b === f.avoid || b === this.host) return false;
      b.holder.getWorldPosition(this.v).project(camera);
      return this.v.z < 1 && Math.abs(this.v.x) < 0.82 && this.v.y < 0.6 && this.v.y > -0.8;
    });
    return ok.length ? ok[(Math.random() * ok.length) | 0] : null;
  }

  update(dt: number, t: number, camera: THREE.Camera, f: AlienFrame) {
    if (f.hidden) {
      this.want = 0;
      this.peek = Math.max(0, this.peek - dt * 4);
      this.group.visible = this.peek > 0.01;
      if (!this.group.visible) return;
    }
    // saklıyken bekle, sonra yeni bir gezegen seç
    if (this.want === 0 && this.peek < 0.02 && !f.hidden) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const h = this.choose(f, camera);
        if (h) {
          this.host = h;
          this.want = 1;
          this.wait = 9 + Math.random() * 8;
        } else this.wait = 2;
      }
    }
    const host = this.host;
    if (!host) return;
    if (this.want === 1 && !f.hidden) {
      if (host === f.avoid) this.scare();
      this.wait -= dt;
      if (this.wait <= 0) {
        // canı sıkıldı: kendiliğinden saklanıp yer değiştirir
        this.want = 0;
        this.wait = 3 + Math.random() * 4;
      }
    }
    // irkilme: önce gözler açılır, küçük bir sıçrama, sonra hızla aşağı
    let jump = 0,
      wide = 0;
    if (this.startle >= 0) {
      this.startle += dt;
      const u = this.startle / 0.34;
      jump = Math.sin(Math.min(1, u) * Math.PI) * 0.35;
      wide = 1;
      if (u >= 1) {
        this.startle = -1;
        this.want = 0;
        this.wait = 4 + Math.random() * 5;
      }
    }
    const sp = this.want ? 2.6 : 9;
    this.peek += (this.want - this.peek) * Math.min(1, dt * sp);
    this.group.visible = this.peek > 0.01;
    if (!this.group.visible) return;

    const R = host.opts.size;
    const P = host.holder.getWorldPosition(this.v);
    const s = 0.24 + R * 0.2;
    // gezegenin arkasından, tepesinin üzerinden bakar
    const back = this.v2.copy(P).sub(camera.position).setY(0).normalize();
    const lift = R * (0.35 + 0.95 * this.peek) + jump * s * 2;
    this.group.position.copy(P).addScaledVector(back, R * 0.55);
    this.group.position.y += lift + s * 0.2;
    this.group.scale.setScalar(s);
    this.group.lookAt(
      camera.position.x,
      this.group.position.y + (camera.position.y - this.group.position.y) * 0.5,
      camera.position.z,
    );

    // ekrandaki yeri: imleç yaklaşınca irkilir
    this.v.copy(this.group.position).project(camera);
    this.screen.x = (this.v.x * 0.5 + 0.5) * innerWidth;
    this.screen.y = (-this.v.y * 0.5 + 0.5) * innerHeight;
    const d = Math.hypot(this.screen.x - f.px, this.screen.y - f.py);
    if (this.want && this.peek > 0.6 && d < 78) this.scare();

    // merakla başını eğer, antenleri sallanır
    this.head.rotation.z = Math.sin(t * 1.3) * 0.12 * this.peek;
    this.head.rotation.y = Math.sin(t * 0.7) * 0.2;
    this.tips.forEach((tip, i) => {
      tip.position.y = 1.4 + Math.sin(t * 3 + i * 2) * 0.05 + jump * 0.5;
      (tip.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + f.night * 0.9 + wide;
    });
    this.hands.forEach((h) => (h.position.y = -0.95 - (1 - this.peek) * 0.6));
    // göz kırpma
    this.blink -= dt;
    let closed = 0;
    if (this.blink < 0.12) closed = 1;
    if (this.blink < 0) this.blink = 2 + Math.random() * 3.5;
    if (wide) closed = 0;
    this.lids.forEach((l) => {
      l.visible = closed > 0;
    });
    this.pupils.forEach((p, i) => p.scale.set(0.82 * (1 + wide * 0.25), 1.15 * (1 + wide * 0.3), 0.5));
  }
}
