/*
  Gece gündüz düğmesi: küçük bir gökyüzü sahnesi (SVG, 200×88).
  Uzaylı ay kediyi soldan iterek getirir, ay güneşe dayanıp onu sahneden çıkarır; gündüze dönerken tersi olur.
  Bütün hareket tek zaman çizelgesinde, sahnenin kendi koordinatlarında tanımlı: düğmenin boyu değişse de bozulmaz.
  Diğer iki tasarım (oda ve UFO) design/gece-gunduz-dugmesi.html dosyasında duruyor.
*/
type Pose = 'day' | 'night';
type Key = [number, Record<string, string | number>, string?];
let uid = 0;
/** Dönüşüm metni: önce taşı, sonra döndür, sonra ölçekle. */
const T = (x: number, y: number, r = 0, sx = 1, sy = sx) =>
  `translate(${x}px, ${y}px) rotate(${r}deg) scale(${sx}, ${sy})`;
/** Bir elemanın bütün zaman çizelgesi tek animasyon: [zaman(ms), özellikler, geçiş eğrisi]. */
function track(el: Element, total: number, keys: Key[]) {
  const k = keys.slice();
  if (k[0][0] > 0) k.unshift([0, k[0][1]]);
  if (k[k.length - 1][0] < total) k.push([total, k[k.length - 1][1]]);
  return el.animate(
    k.map(([t, p, e]) => ({ ...p, offset: t / total, easing: e || 'linear' })),
    { duration: total, fill: 'forwards' },
  );
}
const IO = 'cubic-bezier(.45,0,.3,1)';
const OUT = 'cubic-bezier(.2,.7,.3,1)';
const IN = 'cubic-bezier(.6,0,.9,.5)';
const set = (el: Element, p: Record<string, string | number>) => Object.assign((el as HTMLElement).style, p);

/* ---------- ortak çizimler ---------- */
const sunG = () => `
  <g>${Array.from({ length: 12 }, (_, i) => `<path d="M-4.2,-25 L0,-34 L4.2,-25 Z" fill="#f9c95a" transform="rotate(${i * 30})"/>`).join('')}</g>
  <circle r="24" fill="url(#ts-sunf)"/>
  <circle cx="-13.5" cy="5" r="3.6" fill="#f59ab0" opacity=".55"/><circle cx="13.5" cy="5" r="3.6" fill="#f59ab0" opacity=".55"/>
  <circle cx="-7.5" cy="-2" r="2.7" fill="#6b3b12"/><circle cx="7.5" cy="-2" r="2.7" fill="#6b3b12"/>
  <circle cx="-6.6" cy="-3" r=".9" fill="#fff"/><circle cx="8.4" cy="-3" r=".9" fill="#fff"/>
  <path d="M-6,6 Q0,12 6,6" fill="none" stroke="#6b3b12" stroke-width="2" stroke-linecap="round"/>
  <g transform="rotate(-14)"><ellipse cx="0" cy="-19" rx="16" ry="4.6" fill="#e3bf7a"/><path d="M-9,-20 Q-9,-31 0,-31 Q9,-31 9,-20 Z" fill="#f6dfae"/><path d="M-9,-22.5 H9" stroke="#f28ac0" stroke-width="2.6"/></g>`;
const moonG = () => `
  <path d="M-21,-12 L-17,-31 L-5,-21 Z" fill="#d8d2ee"/><path d="M21,-12 L17,-31 L5,-21 Z" fill="#d8d2ee"/>
  <path d="M-17.5,-16 L-16,-26 L-9.5,-20.5 Z" fill="#f7b6d2"/><path d="M17.5,-16 L16,-26 L9.5,-20.5 Z" fill="#f7b6d2"/>
  <circle r="24" fill="url(#ts-moonf)"/>
  <path d="M-13,-2 q4.5,4.5 9,0 M4,-2 q4.5,4.5 9,0" fill="none" stroke="#6a5a9a" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="0" cy="5" rx="2.6" ry="1.9" fill="#f28ac0"/>
  <path d="M0,7 q-3,4 -6,1.5 M0,7 q3,4 6,1.5" fill="none" stroke="#6a5a9a" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M-22,3 h-7 M-22,7 l-6,2.5 M22,3 h7 M22,7 l6,2.5" stroke="#b9b0dc" stroke-width="1.1" stroke-linecap="round"/>`;
/** Uzaylı: ayaklarının ortası (0,0). push: kollar öne uzanır. */
const alienG = (push: boolean) => `
  <g class="bob">
    <line class="leg l1" x1="-4" y1="-10" x2="-4.5" y2="0" stroke="#6fbf78" stroke-width="3.4" stroke-linecap="round"/>
    <line class="leg l2" x1="4" y1="-10" x2="4.5" y2="0" stroke="#6fbf78" stroke-width="3.4" stroke-linecap="round"/>
    <rect x="-8" y="-23" width="16" height="15" rx="6.5" fill="#8fd694"/>
    ${
      push
        ? '<path d="M5,-18 L15,-21 M5,-13.5 L15,-16" stroke="#6fbf78" stroke-width="3" stroke-linecap="round"/>'
        : '<path class="arms" d="M-8,-18 L-12,-10.5 M8,-18 L12,-10.5" stroke="#6fbf78" stroke-width="3" stroke-linecap="round"/>'
    }
    <path d="M-5,-36 L-7.5,-43 M5,-36 L7.5,-43" stroke="#6fbf78" stroke-width="1.8" stroke-linecap="round"/>
    <circle cx="-7.8" cy="-44" r="2.1" fill="#f5c45e"/><circle cx="7.8" cy="-44" r="2.1" fill="#f5c45e"/>
    <ellipse cx="0" cy="-29.5" rx="11.5" ry="8.8" fill="#8fd694"/>
    <g class="eyes"><ellipse cx="-4.4" cy="-29.5" rx="2.7" ry="3.7" fill="#241a33" transform="rotate(12 -4.4 -29.5)"/><ellipse cx="4.4" cy="-29.5" rx="2.7" ry="3.7" fill="#241a33" transform="rotate(-12 4.4 -29.5)"/></g>
    <path d="M-2,-23.6 q2,1.6 4,0" fill="none" stroke="#3f8f4c" stroke-width="1.1" stroke-linecap="round"/>
  </g>`;
const defs = (id: number) => `
  <defs>
    <clipPath id="c${id}"><rect width="200" height="88"/></clipPath>
    <linearGradient id="d${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd8f5"/><stop offset="1" stop-color="#fde3cd"/></linearGradient>
    <linearGradient id="n${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17133a"/><stop offset="1" stop-color="#4a2f6b"/></linearGradient>
    <radialGradient id="ts-sunf" cx="36%" cy="32%" r="75%"><stop offset="0" stop-color="#fff6c9"/><stop offset=".6" stop-color="#f7c548"/><stop offset="1" stop-color="#ee9f3a"/></radialGradient>
    <radialGradient id="ts-moonf" cx="36%" cy="32%" r="75%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e6e2f6"/><stop offset="1" stop-color="#c2bae4"/></radialGradient>
  </defs>`;
const stars = (list: [number, number, number, string?][]) =>
  `<g class="stars">${list.map(([x, y, r, c]) => `<circle class="tw" cx="${x}" cy="${y}" r="${r}" fill="${c || '#fff'}"/>`).join('')}</g>`;
const cloud = (x: number, y: number, s: number) =>
  `<g transform="translate(${x},${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="13" ry="6"/><ellipse cx="-6" cy="-4" rx="7" ry="5.5"/><ellipse cx="5" cy="-5.5" rx="8" ry="6.5"/></g>`;
const zzz = (x: number, y: number) =>
  `<g class="zzz" font-family="JetBrains Mono, monospace" font-weight="700" fill="#d9ccff"><text x="${x}" y="${y}" font-size="9">z</text><text x="${x + 7}" y="${y - 8}" font-size="12">z</text></g>`;

/* ---------- 1) uzaylı iter ---------- */
export function themeScene(host: HTMLElement) {
  const id = ++uid;
  host.innerHTML = `<svg viewBox="0 0 200 88" aria-hidden="true">${defs(id)}
    <g clip-path="url(#c${id})">
      <rect width="200" height="88" fill="url(#d${id})"/>
      <rect class="night" width="200" height="88" fill="url(#n${id})"/>
      ${stars([
        [22, 20, 1.6],
        [48, 60, 1.2, '#f7c548'],
        [70, 28, 1.3],
        [92, 14, 1.8, '#f28ac0'],
        [36, 40, 1],
        [104, 52, 1.2],
        [14, 70, 1.3, '#cdb8ff'],
        [80, 72, 1],
      ])}
      <g class="clouds">${cloud(128, 34, 1)}${cloud(164, 58, 1.25)}</g>
      <g class="sun"><g class="spin">${sunG()}</g></g>
      <g class="moon"><g class="spin">${moonG()}</g></g>
      <g class="zz">${zzz(104, 30)}</g>
      <g class="alien"><g class="flip">${alienG(true)}<path class="sweat" d="M13,-40 q3,5 0,7 q-3,-2 0,-7 Z" fill="#7fd0f5"/></g></g>
    </g></svg>`;
  const q = (s: string) => host.querySelector(s)!;
  const sun = q('.sun'),
    moon = q('.moon'),
    sunS = q('.sun .spin'),
    moonS = q('.moon .spin'),
    night = q('.night'),
    st = q('.stars'),
    cl = q('.clouds'),
    al = q('.alien'),
    flip = q('.alien .flip'),
    sweat = q('.sweat'),
    zz = q('.zz');
  const Y = 44,
    AY = 81,
    D = 54; // gövdelerin çapı (ışınlar ve kulaklar dahil temas mesafesi)
  const SX = 56,
    MX = 144; // güneşin ve ayın yeri
  const P = {
    day: () => {
      set(sun, { transform: T(SX, Y) });
      set(sunS, { transform: 'rotate(0deg)' });
      set(moon, { transform: T(-46, Y) });
      set(moonS, { transform: 'rotate(0deg)' });
      set(night, { opacity: 0 });
      set(st, { opacity: 0 });
      set(cl, { opacity: 1, transform: T(0, 0) });
      set(al, { transform: T(-90, AY) });
      set(flip, { transform: 'scale(1,1)' });
      set(sweat, { opacity: 0 });
      set(zz, { opacity: 0 });
    },
    night: () => {
      set(sun, { transform: T(250, Y) });
      set(sunS, { transform: 'rotate(0deg)' });
      set(moon, { transform: T(MX, Y) });
      set(moonS, { transform: 'rotate(0deg)' });
      set(night, { opacity: 1 });
      set(st, { opacity: 1 });
      set(cl, { opacity: 0, transform: T(30, 0) });
      set(al, { transform: T(290, AY) });
      set(flip, { transform: 'scale(-1,1)' });
      set(sweat, { opacity: 0 });
      set(zz, { opacity: 1 });
    },
  };
  const TOTAL = 2500;
  function play(next: Pose) {
    const A: Animation[] = [];
    const walk = (a: number, b: number) => {
      setTimeout(() => al.classList.add('walk'), a);
      setTimeout(() => al.classList.remove('walk'), b);
    };
    if (next === 'night') {
      // ay soldan gelir; güneşe değdiği an (ay = SX - D) ikisi birlikte yürür
      const hit = SX - D;
      A.push(
        track(moon, TOTAL, [
          [0, { transform: T(-46, Y) }],
          [300, { transform: T(hit, Y) }],
          [1400, { transform: T(MX, Y) }, OUT],
          [1560, { transform: T(MX + 3, Y) }, IO],
          [1750, { transform: T(MX, Y) }],
        ]),
      );
      A.push(
        track(moonS, TOTAL, [
          [0, { transform: 'rotate(-360deg)' }],
          [1400, { transform: 'rotate(0deg)' }],
        ]),
      );
      A.push(
        track(sun, TOTAL, [
          [0, { transform: T(SX, Y) }],
          [300, { transform: T(SX, Y) }],
          [1400, { transform: T(MX + D, Y) }, OUT],
          [1900, { transform: T(250, Y) }],
        ]),
      );
      A.push(
        track(sunS, TOTAL, [
          [300, { transform: 'rotate(0deg)' }],
          [1900, { transform: 'rotate(360deg)' }],
        ]),
      );
      A.push(
        track(al, TOTAL, [
          [0, { transform: T(-46 - 42, AY) }],
          [300, { transform: T(hit - 42, AY) }],
          [1400, { transform: T(MX - 42, AY) }],
          [1850, { transform: T(MX - 42, AY) }, IN],
          [2500, { transform: T(-90, AY) }],
        ]),
      );
      A.push(
        track(flip, TOTAL, [
          [0, { transform: 'scale(1,1)' }],
          [1800, { transform: 'scale(1,1)' }],
          [1850, { transform: 'scale(-1,1)' }],
        ]),
      );
      A.push(
        track(sweat, TOTAL, [
          [1400, { opacity: 0 }],
          [1500, { opacity: 1 }],
          [1800, { opacity: 0 }],
        ]),
      );
      A.push(
        track(night, TOTAL, [
          [300, { opacity: 0 }],
          [1500, { opacity: 1 }, IO],
        ]),
      );
      A.push(
        track(st, TOTAL, [
          [1100, { opacity: 0 }],
          [1700, { opacity: 1 }],
        ]),
      );
      A.push(
        track(cl, TOTAL, [
          [200, { opacity: 1, transform: T(0, 0) }],
          [1000, { opacity: 0, transform: T(30, 0) }, IO],
        ]),
      );
      A.push(
        track(zz, TOTAL, [
          [1900, { opacity: 0 }],
          [2400, { opacity: 1 }],
        ]),
      );
      walk(0, 1400);
      walk(1850, 2500);
    } else {
      // güneş sağdan geri gelir; aya değdiği an (güneş = MX + D) ayı sola sürer
      const hit = MX + D;
      A.push(
        track(sun, TOTAL, [
          [0, { transform: T(250, Y) }],
          [300, { transform: T(hit, Y) }],
          [1400, { transform: T(SX, Y) }, OUT],
          [1560, { transform: T(SX - 3, Y) }, IO],
          [1750, { transform: T(SX, Y) }],
        ]),
      );
      A.push(
        track(sunS, TOTAL, [
          [0, { transform: 'rotate(360deg)' }],
          [1400, { transform: 'rotate(0deg)' }],
        ]),
      );
      A.push(
        track(moon, TOTAL, [
          [0, { transform: T(MX, Y) }],
          [300, { transform: T(MX, Y) }],
          [1400, { transform: T(SX - D, Y) }, OUT],
          [1900, { transform: T(-46, Y) }],
        ]),
      );
      A.push(
        track(moonS, TOTAL, [
          [300, { transform: 'rotate(0deg)' }],
          [1900, { transform: 'rotate(-360deg)' }],
        ]),
      );
      A.push(
        track(al, TOTAL, [
          [0, { transform: T(250 + 42, AY) }],
          [300, { transform: T(hit + 42, AY) }],
          [1400, { transform: T(SX + 42, AY) }],
          [1850, { transform: T(SX + 42, AY) }, IN],
          [2500, { transform: T(290, AY) }],
        ]),
      );
      A.push(
        track(flip, TOTAL, [
          [0, { transform: 'scale(-1,1)' }],
          [1800, { transform: 'scale(-1,1)' }],
          [1850, { transform: 'scale(1,1)' }],
        ]),
      );
      A.push(
        track(sweat, TOTAL, [
          [1400, { opacity: 0 }],
          [1500, { opacity: 1 }],
          [1800, { opacity: 0 }],
        ]),
      );
      A.push(
        track(night, TOTAL, [
          [300, { opacity: 1 }],
          [1500, { opacity: 0 }, IO],
        ]),
      );
      A.push(
        track(st, TOTAL, [
          [200, { opacity: 1 }],
          [800, { opacity: 0 }],
        ]),
      );
      A.push(
        track(cl, TOTAL, [
          [1200, { opacity: 0, transform: T(30, 0) }],
          [2100, { opacity: 1, transform: T(0, 0) }, OUT],
        ]),
      );
      A.push(
        track(zz, TOTAL, [
          [0, { opacity: 1 }],
          [250, { opacity: 0 }],
        ]),
      );
      walk(0, 1400);
      walk(1850, 2500);
    }
    return { A, total: TOTAL };
  }
  return { pose: (s: Pose) => P[s](), play };
}
