import * as THREE from 'three';
import { clay } from './characters/kit';

function trailTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 32);
  // kenarlara doğru incelsin
  x.globalCompositeOperation = 'destination-in';
  const v = x.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = v;
  x.fillRect(0, 0, 256, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Meteor {
  g: THREE.Group;
  rock: THREE.Mesh;
  trail: THREE.Sprite;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  spin: THREE.Vector3;
}

/** Arka planda ara sıra süzülüp geçen kil meteorlar: yamuk bir kaya ve arkasında yumuşak bir iz. */
export class Meteors {
  private pool: Meteor[] = [];
  private wait = 5;
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private tex = trailTexture();

  constructor(private scene: THREE.Scene) {
    const tints = ['#D9B9A0', '#C9B4DA', '#E8C58C'];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const p = geo.attributes.position as THREE.BufferAttribute;
      // köşeleri rastgele içeri-dışarı iterek yamuk bir kaya yap (aynı konumdaki köşeler aynı kalsın)
      const seen = new Map<string, number>();
      for (let k = 0; k < p.count; k++) {
        const key = `${p.getX(k).toFixed(3)},${p.getY(k).toFixed(3)},${p.getZ(k).toFixed(3)}`;
        let f = seen.get(key);
        if (f === undefined) {
          f = 0.72 + Math.random() * 0.5;
          seen.set(key, f);
        }
        p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.8, p.getZ(k) * f);
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(geo, clay(tints[i], { emissive: 0.2, rough: 0.95 }));
      const trail = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, opacity: 0.7 }),
      );
      trail.center.set(1, 0.5);
      const g = new THREE.Group();
      g.add(trail, rock);
      g.visible = false;
      scene.add(g);
      this.pool.push({
        g,
        rock,
        trail,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        t: -1,
        dur: 5,
        spin: new THREE.Vector3(),
      });
    }
  }

  private spawn(camera: THREE.PerspectiveCamera) {
    const m = this.pool.find((x) => x.t < 0);
    if (!m) return;
    const fwd = new THREE.Vector3(),
      right = new THREE.Vector3(),
      up = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    right.crossVectors(fwd, camera.up).normalize();
    up.crossVectors(right, fwd).normalize();
    const d = 70 + Math.random() * 45;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
    const halfW = halfH * camera.aspect;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const base = camera.position.clone().addScaledVector(fwd, d);
    // sol üstten sağ alta (ya da tersi) çapraz geçer
    const y0 = halfH * (0.35 + Math.random() * 0.75),
      y1 = y0 - halfH * (0.5 + Math.random() * 0.6);
    m.from
      .copy(base)
      .addScaledVector(right, -dir * (halfW + 8))
      .addScaledVector(up, y0);
    m.to
      .copy(base)
      .addScaledVector(right, dir * (halfW + 8))
      .addScaledVector(up, y1)
      .addScaledVector(fwd, (Math.random() - 0.5) * 30);
    m.dur = 5.5 + Math.random() * 4;
    m.t = 0;
    m.g.scale.setScalar(0.7 + Math.random() * 0.9);
    m.spin.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    m.g.visible = true;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, night: number, paused: boolean) {
    if (!paused) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.spawn(camera);
        this.wait = 5 + Math.random() * 8;
      }
    }
    for (const m of this.pool) {
      if (m.t < 0) continue;
      m.t += dt;
      const u = m.t / m.dur;
      if (u >= 1 || (paused && u > 0.999)) {
        m.t = -1;
        m.g.visible = false;
        continue;
      }
      m.g.position.lerpVectors(m.from, m.to, u);
      m.rock.rotation.x += m.spin.x * dt * 1.6;
      m.rock.rotation.y += m.spin.y * dt * 1.6;
      m.rock.rotation.z += m.spin.z * dt * 1.6;
      // izin ekrandaki açısı: hareket yönünün tersine uzanır
      this.a.copy(m.from).project(camera);
      this.b.copy(m.to).project(camera);
      const ang = Math.atan2(this.b.y - this.a.y, (this.b.x - this.a.x) * camera.aspect);
      const mat = m.trail.material;
      mat.rotation = ang;
      const fade = Math.min(1, u * 8) * Math.min(1, (1 - u) * 8);
      mat.opacity = fade * (0.55 + night * 0.4);
      mat.color.set(night > 0.5 ? '#FFE2B0' : '#F2A27A');
      mat.blending = night > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.trail.scale.set(11, 1.5, 1);
    }
  }
}
