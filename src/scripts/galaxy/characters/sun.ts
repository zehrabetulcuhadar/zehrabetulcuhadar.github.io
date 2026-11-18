import * as THREE from 'three';
import { clay, clayBump, damp, ease, OneShot, type Character, type CharacterState } from './kit';

/**
 * Güneş: tombul, kilden bir güneş. Hasır şapkası yana yatmış, yanakları pembe, ışınları yumuşak damlalar.
 * Kedi-ayın gündüz arkadaşı: o uyurken güneş uyanıktır, göz kırpar, etrafında iki küçük bulut gezer.
 * Üzerine gelince gözleri güler, ışınları uzar. Tıklanınca zıplar, şapkası havaya fırlar, ışınları döner.
 */

/** Yumuşak uçlu damla: ışınların şekli (torna ile). */
function dropGeometry(len: number, wid: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    // tabanda geniş, uca doğru yuvarlanarak incelir
    const r = wid * Math.pow(Math.sin(Math.PI * (0.5 + t * 0.5)), 0.75) * (1 - t * 0.12);
    pts.push(new THREE.Vector2(Math.max(0.0001, r), t * len));
  }
  return new THREE.LatheGeometry(pts, 18);
}

export default function create(): Character {
  const group = new THREE.Group();
  const bob = new THREE.Group(); // zıplama ve ezilme burada
  group.add(bob);

  /* ---------- gövde: üstü açık sarı, altı sıcak turuncu ---------- */
  const bodyGeo = new THREE.SphereGeometry(1, 56, 40);
  {
    const pos = bodyGeo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#FFE38A'),
      mid = new THREE.Color('#FFC64A'),
      bot = new THREE.Color('#FF9F47'),
      c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) c.copy(mid).lerp(top, y);
      else c.copy(mid).lerp(bot, -y);
      col.set([c.r, c.g, c.b], i * 3);
    }
    bodyGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.8,
    bumpMap: clayBump(),
    bumpScale: 0.6,
    emissive: '#FFB03A',
    emissiveIntensity: 0.3,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.scale.set(1, 0.97, 0.9);
  bob.add(body);

  /* ---------- ışınlar: gövdenin arkasında, bir uzun bir kısa ---------- */
  const rays = new THREE.Group();
  rays.position.z = -0.16;
  bob.add(rays);
  const N = 14;
  const rayList: { m: THREE.Mesh; a: number; long: boolean }[] = [];
  const longGeo = dropGeometry(0.78, 0.25),
    shortGeo = dropGeometry(0.5, 0.2);
  const rayA = clay('#FFB84D', { emissive: 0.34 }),
    rayB = clay('#FFD86B', { emissive: 0.34 });
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const long = i % 2 === 0;
    const m = new THREE.Mesh(long ? longGeo : shortGeo, long ? rayA : rayB);
    m.position.set(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0);
    m.rotation.z = a - Math.PI / 2;
    m.scale.z = 0.62; // yassı, yaprak gibi
    rays.add(m);
    rayList.push({ m, a, long });
  }

  /* ---------- yüz ---------- */
  const face = new THREE.Group();
  bob.add(face);
  const brown = new THREE.MeshBasicMaterial({ color: '#6B3B12' });
  const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const eyes: { open: THREE.Group; smile: THREE.Mesh }[] = [];
  [-1, 1].forEach((s) => {
    const open = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 16), brown);
    ball.scale.set(0.9, 1.15, 0.5);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), white);
    shine.position.set(0.035, 0.05, 0.05);
    const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), white);
    shine2.position.set(-0.03, -0.04, 0.055);
    open.add(ball, shine, shine2);
    open.position.set(s * 0.33, 0.16, 0.82);
    open.scale.setScalar(1.15);
    open.rotation.y = s * 0.3;
    // gülen göz: yukarı kavisli yay
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.026, 8, 20, Math.PI), brown);
    smile.position.set(s * 0.33, 0.12, 0.84);
    smile.scale.setScalar(1.15);
    smile.rotation.y = s * 0.3;
    smile.visible = false;
    face.add(open, smile);
    eyes.push({ open, smile });
    const cheek = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 16, 10),
      new THREE.MeshBasicMaterial({ color: '#FF8FA8', transparent: true, opacity: 0.6 }),
    );
    cheek.scale.set(1, 0.62, 0.25);
    cheek.position.set(s * 0.56, -0.07, 0.7);
    cheek.rotation.y = s * 0.55;
    face.add(cheek);
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 8, 24, Math.PI), brown);
  mouth.position.set(0, -0.08, 0.89);
  mouth.rotation.z = Math.PI;
  face.add(mouth);
  /* ---------- hasır şapka: yana yatmış, pembe kurdeleli ---------- */
  const hat = new THREE.Group();
  const straw = clay('#F3D79A', { emissive: 0.12 });
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.7, 0.05, 40), straw);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.3, 32), straw);
  crown.position.y = 0.17;
  const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), straw);
  topCap.position.y = 0.32;
  topCap.scale.y = 0.25;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.415, 0.1, 32), clay('#F28AC0', { emissive: 0.15 }));
  ribbon.position.y = 0.09;
  // hasırın örgü çizgileri
  const weave = clay('#DDB970');
  [0.5, 0.6].forEach((r) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 6, 48), weave);
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.03;
    hat.add(t);
  });
  // kurdelenin fiyongu
  [-1, 1].forEach((s) => {
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), clay('#F28AC0', { emissive: 0.15 }));
    bow.scale.set(1.3, 0.8, 0.5);
    bow.position.set(s * 0.1, 0.09, 0.42);
    bow.rotation.z = s * 0.5;
    hat.add(bow);
  });
  hat.add(brim, crown, topCap, ribbon);
  const HAT = { x: -0.3, y: 0.84, z: 0.2, rz: 0.36, rx: 0.34 };
  hat.position.set(HAT.x, HAT.y, HAT.z);
  hat.rotation.set(HAT.rx, 0, HAT.rz);
  bob.add(hat);

  /* ---------- etrafında gezen iki küçük bulut ---------- */
  const cloudMat = clay('#FFFFFF', { emissive: 0.3 });
  const clouds = [0, 1].map((k) => {
    const c = new THREE.Group();
    [
      [0, 0, 0.17],
      [0.17, -0.02, 0.13],
      [-0.17, -0.03, 0.12],
      [0.05, 0.1, 0.12],
    ].forEach(([x, y, r]) => {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), cloudMat);
      p.position.set(x, y, 0);
      c.add(p);
    });
    c.scale.setScalar(k ? 0.8 : 1);
    group.add(c);
    return c;
  });

  const pop = new OneShot(1.5);
  let blink = 2.5;
  let stretch = 0;
  let rayTurn = 0;

  function update(s: CharacterState) {
    const { dt, t, hover, reduce } = s;
    const amp = reduce ? 0.25 : 1;
    const p = pop.tick(dt);

    // nefes alır gibi hafif şişip iner
    const breathe = Math.sin(t * 1.4) * 0.018 * amp;
    let jump = 0,
      squash = 0,
      hatFly = 0,
      hatSpin = 0;
    if (p >= 0) {
      // çömel, zıpla, yaylanarak in; şapka biraz geç kalır
      const u = p;
      jump = Math.sin(Math.min(1, u / 0.6) * Math.PI) * 0.42;
      squash =
        u < 0.12
          ? -Math.sin((u / 0.12) * Math.PI) * 0.12
          : u > 0.6
            ? Math.sin(((u - 0.6) / 0.4) * Math.PI * 3) * 0.06 * (1 - u) * 2.5
            : 0.05;
      const h = Math.min(1, u / 0.85);
      hatFly = Math.sin(h * Math.PI) * 0.75;
      hatSpin = ease.inOut(h) * Math.PI * 2;
      rayTurn = ease.out(Math.min(1, u / 0.9)) * ((Math.PI * 2) / N) * 2;
    } else rayTurn = 0;
    bob.position.y = jump;
    bob.scale.set(1 + breathe - squash * 0.6, 1 + breathe + squash, 1 + breathe - squash * 0.6);
    bob.rotation.z = Math.sin(t * 0.8) * 0.05 * amp;

    // ışınlar: çevresinde dolaşan yumuşak bir dalga; üzerine gelince uzarlar
    stretch = damp(stretch, hover + (p >= 0 ? 0.6 : 0), 6, dt);
    rays.rotation.z = rayTurn + Math.sin(t * 0.5) * 0.06 * amp;
    rayList.forEach(({ m, a, long }, i) => {
      const w = Math.sin(t * 2.2 - i * ((Math.PI * 2) / N) * 2) * 0.09 * amp;
      const len = 1 + w + stretch * (long ? 0.32 : 0.2);
      m.scale.set(1 + stretch * 0.06, len, 0.62);
      m.rotation.z = a - Math.PI / 2 + Math.sin(t * 1.6 + i) * 0.05 * amp;
    });

    // gözler: ara sıra kırpar; üzerine gelince (ya da zıplarken) güler
    blink -= dt;
    if (blink < 0) blink = 2.2 + Math.random() * 3;
    const happy = hover > 0.45 || p >= 0;
    const closed = blink < 0.13;
    eyes.forEach(({ open, smile }) => {
      open.visible = !happy;
      smile.visible = happy;
      open.scale.y = closed ? 0.14 : 1.15;
    });
    mouth.scale.setScalar(1 + (happy ? 0.25 : 0));

    // şapka: hafifçe sallanır; zıplayınca havada bir tur atıp geri konar
    hat.position.set(HAT.x, HAT.y + hatFly + Math.sin(t * 1.4 + 0.6) * 0.012, HAT.z);
    hat.rotation.set(HAT.rx, hatSpin, HAT.rz + Math.sin(t * 1.1) * 0.03 * amp);

    // bulutlar: güneşin çevresinde ağır ağır döner, önünden ve arkasından geçer
    clouds.forEach((c, k) => {
      const a = t * 0.22 * (reduce ? 0.3 : 1) + k * Math.PI + 0.6;
      c.position.set(Math.cos(a) * 1.72, -0.5 + k * 0.75 + Math.sin(t * 0.9 + k) * 0.05, Math.sin(a) * 0.95);
    });
  }

  return {
    group,
    update,
    poke() {
      if (!pop.on) pop.start();
    },
  };
}
