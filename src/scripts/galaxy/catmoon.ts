import * as THREE from 'three';

/**
 * Kedi-ay: gece modunda merkezdeki ay, hilal gibi kıvrılıp uyuyan bir kedi.
 * Tamamen kodla kurulur. Gövde, kıvrımı her karede yeniden hesaplanan bir tüp:
 * kıvrım açısı büyüyünce kedi hilal olur, küçülünce gerinip uzar, tam tur olunca top olur.
 * Döngü: uyur (nefes alır, "z" çıkarır) → uyanır, gerinir → top olup yuvarlanır → yine kıvrılır.
 */
type Pose = 'curl' | 'stretch' | 'ball';

const SEG = 56;
const RAD = 16;
const SIZE = 0.62; // sahnedeki boyut (güneşin yarıçapı 2.1)
const LEN = 8.2; // gövdenin yay uzunluğu: kıvrılsa da uzasa da aynı kalır
const POSES: Record<Pose, { arc: number; thick: number }> = {
  curl: { arc: Math.PI * 1.55, thick: 0.6 },
  stretch: { arc: Math.PI * 0.8, thick: 0.55 },
  ball: { arc: Math.PI * 1.97, thick: 1.15 },
};

export class CatMoon {
  group = new THREE.Group();
  private plane = new THREE.Group(); // kameraya dönük düzlem
  private body: THREE.Mesh;
  private pos: Float32Array;
  private head = new THREE.Group();
  private eyesOpen = new THREE.Group();
  private eyesClosed = new THREE.Group();
  private tail: THREE.Mesh;
  private tailPos: Float32Array;
  private paws: THREE.Mesh[] = [];
  private zzz: THREE.Sprite[] = [];
  private arc = POSES.curl.arc;
  private thick = POSES.curl.thick;
  private pose: Pose = 'curl';
  private t = 0;
  private stateT = 7;
  private roll = 0;
  private rollV = 0;
  private plan: { pose: Pose; dur: number }[] = [];
  private awake = 0;
  private q = new THREE.Quaternion();

  constructor(parent: THREE.Object3D) {
    const fur = new THREE.MeshStandardMaterial({
      color: '#EEEAF8',
      emissive: '#7F78B0',
      emissiveIntensity: 0.32,
      roughness: 0.85,
    });
    const dark = new THREE.MeshBasicMaterial({ color: '#3E1F38' });
    const pink = new THREE.MeshStandardMaterial({ color: '#F4A3BE', roughness: 0.7 });

    // gövde (her karede yeniden şekillenen tüp)
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((SEG + 1) * (RAD + 1) * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setIndex(tubeIndex(SEG, RAD));
    this.body = new THREE.Mesh(g, fur);
    this.plane.add(this.body);

    // kuyruk
    const tg = new THREE.BufferGeometry();
    this.tailPos = new Float32Array((24 + 1) * (10 + 1) * 3);
    tg.setAttribute('position', new THREE.BufferAttribute(this.tailPos, 3));
    tg.setIndex(tubeIndex(24, 10));
    const tailFur = fur.clone();
    tailFur.color.set('#D8D0F2');
    tailFur.side = THREE.DoubleSide;
    this.tail = new THREE.Mesh(tg, tailFur);
    this.plane.add(this.tail);

    // kafa: yüz, kulaklar, gözler, burun, yanaklar, gece külahı
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 24), fur);
    skull.scale.set(1.08, 0.95, 0.95);
    this.head.add(skull);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.42, 16), fur);
      ear.position.set(s * 0.36, 0.52, 0);
      ear.rotation.z = -s * 0.35;
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.26, 12), pink);
      inner.position.set(s * 0.36, 0.5, 0.09);
      inner.rotation.z = -s * 0.35;
      this.head.add(ear, inner);
      const closed = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 16, Math.PI), dark);
      closed.position.set(s * 0.24, 0.02, 0.56);
      closed.rotation.z = Math.PI; // uykulu "u" çizgisi
      this.eyesClosed.add(closed);
      const open = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), dark);
      open.scale.set(1, 1.3, 0.6);
      open.position.set(s * 0.24, 0.04, 0.56);
      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#FFFFFF' }),
      );
      shine.position.set(s * 0.24 + 0.03, 0.08, 0.61);
      this.eyesOpen.add(open, shine);
      const cheek = new THREE.Mesh(
        new THREE.CircleGeometry(0.09, 16),
        new THREE.MeshBasicMaterial({ color: '#F4A3BE', transparent: true, opacity: 0.6 }),
      );
      cheek.position.set(s * 0.36, -0.13, 0.55);
      this.head.add(cheek);
    });
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), pink);
    nose.position.set(0, -0.08, 0.6);
    this.head.add(nose, this.eyesClosed, this.eyesOpen);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.42, 0.9, 24),
      new THREE.MeshStandardMaterial({ color: '#7C8CF2', roughness: 0.6 }),
    );
    cap.position.set(0.18, 0.78, -0.05);
    cap.rotation.z = -0.55;
    const pom = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshStandardMaterial({ color: '#F5C45E', emissive: '#F5C45E', emissiveIntensity: 0.4 }),
    );
    pom.position.set(0.58, 1.12, -0.05);
    this.head.add(cap, pom);
    this.plane.add(this.head);

    for (let i = 0; i < 4; i++) {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), fur);
      paw.scale.set(1, 0.75, 1);
      this.paws.push(paw);
      this.plane.add(paw);
    }

    // uyurken çıkan "z" harfleri
    const zTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d')!;
      x.fillStyle = '#F5C45E';
      x.font = 'bold 52px sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('z', 32, 34);
      return new THREE.CanvasTexture(c);
    })();
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false }));
      this.zzz.push(s);
      this.plane.add(s);
    }

    this.group.add(this.plane);
    this.group.scale.setScalar(0.0001);
    parent.add(this.group);
    this.shape(0);
  }

  /** Dokununca uyanır ve oynar. */
  poke() {
    if (this.pose === 'curl')
      this.plan = [
        { pose: 'stretch', dur: 1.4 },
        { pose: 'ball', dur: 3.2 },
        { pose: 'curl', dur: 9 },
      ];
    else this.rollV += 5;
    this.next();
  }

  private next() {
    const step =
      this.plan.shift() ??
      (this.pose === 'curl'
        ? { pose: 'stretch' as Pose, dur: 1.8 }
        : this.pose === 'stretch'
          ? { pose: 'ball' as Pose, dur: 3.4 }
          : { pose: 'curl' as Pose, dur: 8 + Math.random() * 4 });
    this.pose = step.pose;
    this.stateT = step.dur;
    if (this.pose === 'ball') this.rollV = 4.5;
  }

  update(dt: number, camera: THREE.Camera, visible: number, reduce: boolean) {
    this.group.visible = visible > 0.01;
    if (!this.group.visible) return;
    this.t += dt;
    // ebeveyn dönse de kameraya dönük kalsın
    this.group.parent!.getWorldQuaternion(this.q).invert();
    this.plane.quaternion.copy(this.q).multiply(camera.quaternion);
    if (!reduce) {
      this.stateT -= dt;
      if (this.stateT <= 0) this.next();
    }
    const P = POSES[this.pose];
    const k = 1 - Math.pow(0.04, dt);
    this.arc += (P.arc - this.arc) * k;
    this.thick += (P.thick - this.thick) * k;
    this.awake += ((this.pose === 'curl' ? 0 : 1) - this.awake) * k;
    // top olunca yuvarlanır, sonra yavaşlar
    this.roll += this.rollV * dt * (reduce ? 0 : 1);
    this.rollV *= Math.pow(0.35, dt);
    if (this.pose === 'curl') this.roll += (Math.round(this.roll / (Math.PI * 2)) * Math.PI * 2 - this.roll) * k * 0.5;
    this.shape(dt);
    // kıvrılınca hilal (☾) gibi yana yatar; gerinirken yatay durur
    const curl = Math.min(1, Math.max(0, (this.arc - POSES.stretch.arc) / (POSES.curl.arc - POSES.stretch.arc)));
    this.plane.rotateZ(this.roll + curl * -1.1 * (1 - this.ballness()));
    this.group.scale.setScalar(Math.max(0.0001, visible * SIZE));
  }

  /** Gövdeyi, kuyruğu, kafayı ve patileri mevcut kıvrıma göre yerleştirir. */
  private shape(dt: number) {
    const A = this.arc;
    const R = LEN / A;
    const breathe = 1 + Math.sin(this.t * 1.6) * 0.04 * (1 - this.awake);
    const th = this.thick * breathe;
    // yay alttan ortalanır (uçlar yukarıda karşılıklı), sonra ağırlık merkezi orijine çekilir
    // kıvrıkken kase gibi (uçlar yukarıda), gerinirken kemer gibi (sırt yukarıda, patiler altta)
    const cf = Math.min(1, Math.max(0, (A - POSES.stretch.arc) / (POSES.curl.arc - POSES.stretch.arc)));
    const a0 = Math.PI / 2 - cf * Math.PI - A / 2;
    let mx = 0,
      my = 0;
    for (let i = 0; i <= 16; i++) {
      const a = a0 + (A * i) / 16;
      mx += Math.cos(a) * R;
      my += Math.sin(a) * R;
    }
    mx /= 17;
    my /= 17;
    const center = (u: number, out: THREE.Vector3) => {
      const a = a0 + A * u;
      return out.set(Math.cos(a) * R - mx, Math.sin(a) * R - my, 0);
    };
    const c = new THREE.Vector3(),
      n = new THREE.Vector3();
    let p = 0;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG;
      const a = a0 + A * u;
      center(u, c);
      n.set(Math.cos(a), Math.sin(a), 0); // dışa doğru
      const r = th * (0.12 + 0.88 * Math.pow(Math.sin(Math.PI * u), 0.4));
      for (let j = 0; j <= RAD; j++) {
        const f = (j / RAD) * Math.PI * 2;
        this.pos[p++] = c.x + n.x * Math.cos(f) * r;
        this.pos[p++] = c.y + n.y * Math.cos(f) * r;
        this.pos[p++] = Math.sin(f) * r;
      }
    }
    const bg = this.body.geometry;
    bg.attributes.position.needsUpdate = true;
    bg.computeVertexNormals();
    bg.computeBoundingSphere();

    // kafa: gövdenin bir ucunda, bize dönük
    const end = center(1, new THREE.Vector3());
    const aEnd = a0 + A;
    const tan = new THREE.Vector3(-Math.sin(aEnd), Math.cos(aEnd), 0);
    this.head.position
      .copy(end)
      .addScaledVector(tan, 0.35)
      .add(new THREE.Vector3(0, 0, 0.25));
    this.head.rotation.set(0, 0, Math.sin(this.t * 0.8) * 0.08 + (1 - this.awake) * -0.25);
    this.head.scale.setScalar(1.3 + this.awake * 0.1);
    this.eyesOpen.visible = this.awake > 0.5;
    this.eyesClosed.visible = !this.eyesOpen.visible;

    // kuyruk: diğer uçtan çıkar, uyurken yavaş, uyanıkken hızlı sallanır
    const start = center(0, new THREE.Vector3());
    const a1 = a0;
    const tdir = new THREE.Vector3(Math.sin(a1), -Math.cos(a1), 0);
    const swish = Math.sin(this.t * (1.2 + this.awake * 4)) * (0.4 + this.awake * 0.5);
    let q = 0;
    const tc = new THREE.Vector3(),
      tn = new THREE.Vector3();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      const bend = u * u * (-1.2 + 1.6 * swish); // içe doğru kıvrılır, iki yana sallanır
      tc.copy(start).addScaledVector(tdir, u * 1.9);
      tc.x += Math.cos(a1) * bend;
      tc.y += Math.sin(a1) * bend;
      tn.set(Math.cos(a1), Math.sin(a1), 0);
      const r = 0.22 * (1 - u * 0.5);
      for (let j = 0; j <= 10; j++) {
        const f = (j / 10) * Math.PI * 2;
        this.tailPos[q++] = tc.x + tn.x * Math.cos(f) * r;
        this.tailPos[q++] = tc.y + tn.y * Math.cos(f) * r;
        this.tailPos[q++] = Math.sin(f) * r;
      }
    }
    const tg = this.tail.geometry;
    tg.attributes.position.needsUpdate = true;
    tg.computeVertexNormals();
    tg.computeBoundingSphere();

    // patiler: gerinirken görünür, kıvrılınca gövdeye saklanır
    const stretch = Math.max(0, 1 - (A - POSES.stretch.arc) / (POSES.curl.arc - POSES.stretch.arc));
    [0.22, 0.34, 0.7, 0.82].forEach((u, i) => {
      center(u, c);
      const a = a0 + A * u;
      this.paws[i].position.set(c.x - Math.cos(a) * th * 0.9, c.y - Math.sin(a) * th * 0.9, 0.15);
      this.paws[i].scale.setScalar(Math.max(0.001, stretch));
    });

    // z harfleri
    this.zzz.forEach((s, i) => {
      const life = (this.t * 0.45 + i / 3) % 1;
      s.position.copy(this.head.position).add(new THREE.Vector3(0.6 + life * 1.2, 0.5 + life * 1.6, 0.3));
      s.scale.setScalar(0.25 + life * 0.35);
      (s.material as THREE.SpriteMaterial).opacity = (1 - this.awake) * Math.sin(life * Math.PI);
    });
    void dt;
  }

  private ballness() {
    return Math.min(1, Math.max(0, (this.arc - POSES.curl.arc) / (POSES.ball.arc - POSES.curl.arc)));
  }

  hit(ray: THREE.Raycaster) {
    return this.group.visible && ray.intersectObject(this.group, true).length > 0;
  }
}

function tubeIndex(seg: number, rad: number) {
  const idx: number[] = [];
  for (let i = 0; i < seg; i++)
    for (let j = 0; j < rad; j++) {
      const a = i * (rad + 1) + j,
        b = a + rad + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  return idx;
}
