/*
  Gece gündüz düğmesi: uzaylının odası (SVG, 200×88).
  Gündüz koltukta telefonuna bakar. Gece olunca perdeyi çeker, bilgisayarın başına geçip kod yazar.
  Bütün hareket tek zaman çizelgesinde, sahnenin kendi koordinatlarında tanımlı: düğmenin boyu değişse de bozulmaz.
  Uzaylı eşyaların hep önünden yürür, koltuğun koluna değmeden üstünden atlar.
  Diğer iki tasarım (uzaylı iter ve UFO) design/gece-gunduz-dugmesi.html dosyasında duruyor.
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
  </defs>`;
const cloud = (x: number, y: number, s: number) =>
  `<g transform="translate(${x},${y}) scale(${s})" fill="#fff"><ellipse cx="0" cy="0" rx="13" ry="6"/><ellipse cx="-6" cy="-4" rx="7" ry="5.5"/><ellipse cx="5" cy="-5.5" rx="8" ry="6.5"/></g>`;
/* ---------- uzaylının odası ---------- */
export function themeScene(host: HTMLElement) {
  const id = ++uid;
  const S = 0.8;
  host.innerHTML = `<svg viewBox="0 0 200 88" aria-hidden="true">${defs(id)}
    <defs><linearGradient id="cu${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e98bb4"/><stop offset=".25" stop-color="#f7b6d2"/><stop offset=".5" stop-color="#e98bb4"/><stop offset=".75" stop-color="#f7b6d2"/><stop offset="1" stop-color="#e17ea9"/></linearGradient>
    <clipPath id="w${id}"><rect x="80" y="14" width="40" height="38" rx="3"/></clipPath>
    <radialGradient id="sg${id}"><stop offset="0" stop-color="#9fe3ff" stop-opacity=".8"/><stop offset="1" stop-color="#9fe3ff" stop-opacity="0"/></radialGradient></defs>
    <g clip-path="url(#c${id})">
      <rect width="200" height="88" fill="#fbe7d8"/>
      <rect y="74" width="200" height="14" fill="#e9c3a7"/><rect y="73" width="200" height="2.2" fill="#d9a988"/>
      <ellipse cx="104" cy="81" rx="34" ry="4.5" fill="#f3a9c6" opacity=".7"/>
      <!-- pencere -->
      <g clip-path="url(#w${id})">
        <rect x="80" y="14" width="40" height="38" fill="url(#d${id})"/>
        <circle cx="108" cy="25" r="6" fill="#f7c548"/>
        ${cloud(91, 40, 0.5)}
        <g class="wn"><rect x="80" y="14" width="40" height="38" fill="url(#n${id})"/><circle cx="108" cy="25" r="5.5" fill="#efeaff"/><circle cx="110.5" cy="23.5" r="4.6" fill="#2a2152"/><circle class="tw" cx="88" cy="22" r="1" fill="#fff"/><circle class="tw" cx="96" cy="36" r=".9" fill="#fff"/><circle class="tw" cx="114" cy="42" r="1" fill="#f7c548"/></g>
      </g>
      <rect x="80" y="14" width="40" height="38" rx="3" fill="none" stroke="#fff" stroke-width="3"/><path d="M100,14 V52 M80,33 H120" stroke="#fff" stroke-width="1.6"/>
      <rect x="76" y="52" width="48" height="3.4" rx="1.7" fill="#fff"/>
      <g transform="translate(74,10)"><rect class="cl" width="27" height="47" rx="3" fill="url(#cu${id})"/></g>
      <g transform="translate(126,10) scale(-1,1)"><rect class="cr" width="27" height="47" rx="3" fill="url(#cu${id})"/></g>
      <rect x="71" y="8" width="58" height="3" rx="1.5" fill="#b9869a"/><circle cx="71" cy="9.5" r="2.4" fill="#e3a93b"/><circle cx="129" cy="9.5" r="2.4" fill="#e3a93b"/>
      <!-- çalışma masası: duvara dayalı, uzaylı önündeki tabureye oturur -->
      <rect x="9" y="60" width="4" height="15" fill="#b98f73"/><rect x="63" y="60" width="4" height="15" fill="#b98f73"/>
      <rect x="6" y="56" width="64" height="4.5" rx="2" fill="#c98f6b"/>
      <!-- saksı -->
      <path d="M9.5,50 h7 l-1,6 h-5 Z" fill="#f28ac0"/><path d="M13,50 q-5,-7 -1,-11 q2,5 1,11 M13,50 q5,-5 3,-10 q-3,3 -3,10" fill="#8fd694"/>
      <!-- ekran -->
      <rect x="31" y="47" width="5" height="9" fill="#8d7aa8"/><rect x="25" y="54.5" width="17" height="2.4" rx="1.2" fill="#8d7aa8"/>
      <rect x="16" y="23" width="35" height="25" rx="3" fill="#4a3f63"/>
      <rect x="18" y="25" width="31" height="21" rx="1.6" fill="#2a2140"/>
      <path d="M20,27 L30,27 L22,35 Z" fill="#fff" opacity=".08"/>
      <g class="scr">
        <rect x="18" y="25" width="31" height="21" rx="1.6" fill="#1d1830"/>
        <path d="M21,29 h9" stroke="#f28ac0" stroke-width="1.5" stroke-linecap="round"/><path d="M32,29 h7" stroke="#9fe3ff" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M23.5,32.5 h12" stroke="#f5c45e" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M23.5,36 h6" stroke="#8fd694" stroke-width="1.5" stroke-linecap="round"/><path d="M31.5,36 h9" stroke="#cdb8ff" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M21,39.5 h8" stroke="#9fe3ff" stroke-width="1.5" stroke-linecap="round"/>
        <rect class="caret" x="30.5" y="38.5" width="1.6" height="2.4" fill="#fff"/>
      </g>
      <circle class="glow" cx="34" cy="38" r="30" fill="url(#sg${id})"/>
      <!-- tabure -->
      <path d="M47.5,66 L46,75 M56.5,66 L58,75" stroke="#8d6a55" stroke-width="2" stroke-linecap="round"/>
      <rect x="44.5" y="63.5" width="15" height="3.6" rx="1.8" fill="#f5c45e"/>
      <!-- koltuk -->
      <rect x="141" y="36" width="38" height="36" rx="10" fill="#ee8fb7"/><rect x="146" y="58" width="28" height="14" rx="4" fill="#f7b6d2"/>
      <rect x="144" y="72" width="4" height="4" fill="#8d6a55"/><rect x="172" y="72" width="4" height="4" fill="#8d6a55"/>
      <rect x="136" y="52" width="11" height="22" rx="5.5" fill="#e17ea9"/><rect x="173" y="52" width="11" height="22" rx="5.5" fill="#e17ea9"/>
      <!-- uzaylı: bütün eşyaların önünde yürür, koltuğun koluna değmeden üstünden atlar -->
      <g class="alien">${alienG(false)}
        <g class="phone"><ellipse cx="0" cy="-26" rx="9" ry="6" fill="#9fe3ff" opacity=".35"/><rect x="-3.6" y="-21" width="7.2" height="10.5" rx="1.6" fill="#2a2140"/><rect x="-2.6" y="-20" width="5.2" height="8" rx="1" fill="#9fe3ff"/><circle class="thumb" cx="1.4" cy="-14" r="1.3" fill="#6fbf78"/><path d="M-8,-18 L-4,-14 M8,-18 L4,-14" stroke="#6fbf78" stroke-width="3" stroke-linecap="round"/></g>
      </g>
      <!-- gece karanlığı; ekranın ışığı karanlığın üstünde kalır -->
      <rect class="dark" width="200" height="88" fill="#120d2c"/>
      <g class="lit">
        <rect x="18" y="25" width="31" height="21" rx="1.6" fill="#9fe3ff" opacity=".16"/>
      </g>
      <g class="zz" font-family="JetBrains Mono, monospace" font-weight="700" fill="#9fe3ff"><g class="zzz"><text x="55" y="27" font-size="8">{ }</text><text x="62" y="17" font-size="10">;</text></g></g>
    </g></svg>`;
  const q = (s: string) => host.querySelector(s)!;
  const al = q('.alien'),
    eyes = q('.alien .eyes'),
    mouth = q('.alien path[stroke="#3f8f4c"]'),
    arms = q('.alien .arms'),
    phone = q('.phone'),
    cL = q('.cl'),
    cR = q('.cr'),
    wn = q('.wn'),
    dark = q('.dark'),
    glow = q('.glow'),
    scr = q('.scr'),
    lit = q('.lit'),
    zz = q('.zz');
  const F = 75; // zemin
  const SIT = T(160, 69, 0, S), // koltukta
    DESK = T(52, 69.5, 0, S); // taburede, sırtı bize dönük
  const cur = (v: number) => ({ transform: `scale(${v},1)` });
  const OPEN = 0.3;
  const face = (v: number) => {
    set(eyes, { opacity: v });
    set(mouth, { opacity: v });
  };
  const P = {
    day: () => {
      al.classList.remove('type');
      set(al, { transform: SIT });
      face(1);
      set(arms, { opacity: 0 });
      set(phone, { opacity: 1 });
      set(cL, cur(OPEN));
      set(cR, cur(OPEN));
      set(wn, { opacity: 0 });
      set(dark, { opacity: 0 });
      set(glow, { opacity: 0 });
      set(scr, { opacity: 0 });
      set(lit, { opacity: 0 });
      set(zz, { opacity: 0 });
    },
    night: () => {
      al.classList.add('type');
      set(al, { transform: DESK });
      face(0);
      set(arms, { opacity: 0 });
      set(phone, { opacity: 0 });
      set(cL, cur(1));
      set(cR, cur(1));
      set(wn, { opacity: 1 });
      set(dark, { opacity: 0.5 });
      set(glow, { opacity: 1 });
      set(scr, { opacity: 1 });
      set(lit, { opacity: 1 });
      set(zz, { opacity: 1 });
    },
  };
  const TOTAL = 4300;
  function play(next: Pose) {
    const A: Animation[] = [];
    const at = (fn: () => void, ms: number) => setTimeout(fn, ms);
    const walk = (a: number, b: number) => {
      at(() => al.classList.add('walk'), a);
      at(() => al.classList.remove('walk'), b);
    };
    al.classList.remove('type');
    if (next === 'night') {
      A.push(
        track(phone, TOTAL, [
          [0, { opacity: 1 }],
          [250, { opacity: 0 }],
        ]),
      );
      A.push(
        track(arms, TOTAL, [
          [0, { opacity: 0 }],
          [250, { opacity: 1 }],
          [3500, { opacity: 1 }],
          [3700, { opacity: 0 }],
        ]),
      );
      A.push(
        track(al, TOTAL, [
          [0, { transform: SIT }],
          [250, { transform: SIT }, OUT],
          // koltuktan kalkar: önce yukarı, sonra kolun üstünden aşıp pencerenin sağına iner
          [480, { transform: T(158, 46, -8, S) }],
          [700, { transform: T(140, 40, -14, S) }, IN],
          [950, { transform: T(124, F, 0, S) }],
          [1050, { transform: T(124, F, 0, S, S * 0.9) }],
          [1150, { transform: T(124, F, 0, S) }],
          [1900, { transform: T(124, F, 0, S) }], // perdeyi çeker
          [2900, { transform: T(69, F, 0, S) }], // taburenin yanına yürür
          [3000, { transform: T(69, F, 0, S, S * 0.9) }, OUT],
          [3250, { transform: T(61, 52, -10, S) }, IN], // tabureye zıplar
          [3500, { transform: T(52, 69.5, 0, S) }],
          [3650, { transform: T(52, 69.5, 0, S * 0.1, S) }], // ekrana döner
          [3800, { transform: DESK }],
        ]),
      );
      A.push(
        track(eyes, TOTAL, [
          [3640, { opacity: 1 }],
          [3660, { opacity: 0 }],
        ]),
      );
      A.push(
        track(mouth, TOTAL, [
          [3640, { opacity: 1 }],
          [3660, { opacity: 0 }],
        ]),
      );
      A.push(
        track(cR, TOTAL, [
          [1200, cur(OPEN)],
          [1850, cur(1), IO],
        ]),
      );
      A.push(
        track(cL, TOTAL, [
          [1200, cur(OPEN)],
          [1850, cur(1), IO],
        ]),
      );
      A.push(
        track(wn, TOTAL, [
          [500, { opacity: 0 }],
          [1500, { opacity: 1 }],
        ]),
      );
      A.push(
        track(dark, TOTAL, [
          [900, { opacity: 0 }],
          [1900, { opacity: 0.5 }, IO],
        ]),
      );
      // ekran açılır: önce bir kırpışma, sonra ışık
      A.push(
        track(scr, TOTAL, [
          [3800, { opacity: 0 }],
          [3860, { opacity: 0.7 }],
          [3920, { opacity: 0.2 }],
          [4050, { opacity: 1 }],
        ]),
      );
      A.push(
        track(lit, TOTAL, [
          [3860, { opacity: 0 }],
          [4100, { opacity: 1 }],
        ]),
      );
      A.push(
        track(glow, TOTAL, [
          [3860, { opacity: 0 }],
          [4150, { opacity: 1 }],
        ]),
      );
      A.push(
        track(zz, TOTAL, [
          [4050, { opacity: 0 }],
          [4300, { opacity: 1 }],
        ]),
      );
      walk(1900, 2900);
      at(() => al.classList.add('type'), 4050);
    } else {
      A.push(
        track(zz, TOTAL, [
          [0, { opacity: 1 }],
          [200, { opacity: 0 }],
        ]),
      );
      A.push(
        track(scr, TOTAL, [
          [150, { opacity: 1 }],
          [400, { opacity: 0 }],
        ]),
      );
      A.push(
        track(lit, TOTAL, [
          [150, { opacity: 1 }],
          [400, { opacity: 0 }],
        ]),
      );
      A.push(
        track(glow, TOTAL, [
          [150, { opacity: 1 }],
          [450, { opacity: 0 }],
        ]),
      );
      A.push(
        track(eyes, TOTAL, [
          [540, { opacity: 0 }],
          [560, { opacity: 1 }],
        ]),
      );
      A.push(
        track(mouth, TOTAL, [
          [540, { opacity: 0 }],
          [560, { opacity: 1 }],
        ]),
      );
      A.push(
        track(arms, TOTAL, [
          [600, { opacity: 0 }],
          [750, { opacity: 1 }],
          [3900, { opacity: 1 }],
          [4100, { opacity: 0 }],
        ]),
      );
      A.push(
        track(al, TOTAL, [
          [0, { transform: DESK }],
          [400, { transform: DESK }],
          [550, { transform: T(52, 69.5, 0, S * 0.1, S) }], // bize döner
          [700, { transform: T(52, 69.5, 0, S) }, OUT],
          [950, { transform: T(61, 52, 10, S) }, IN], // tabureden iner
          [1200, { transform: T(69, F, 0, S) }],
          [1300, { transform: T(69, F, 0, S, S * 0.9) }],
          [1400, { transform: T(69, F, 0, S) }],
          [1600, { transform: T(76, F, 0, S) }], // pencerenin soluna yürür
          [2350, { transform: T(76, F, 0, S) }], // perdeyi açar
          [3150, { transform: T(124, F, 0, S) }], // koltuğun önüne yürür
          [3250, { transform: T(124, F, 0, S, S * 0.9) }, OUT],
          // kolun üstünden aşıp mindere oturur
          [3500, { transform: T(140, 40, 14, S) }],
          [3700, { transform: T(158, 46, 8, S) }, IN],
          [3900, { transform: SIT }],
        ]),
      );
      A.push(
        track(cL, TOTAL, [
          [1650, cur(1)],
          [2300, cur(OPEN), IO],
        ]),
      );
      A.push(
        track(cR, TOTAL, [
          [1650, cur(1)],
          [2300, cur(OPEN), IO],
        ]),
      );
      A.push(
        track(wn, TOTAL, [
          [1300, { opacity: 1 }],
          [2100, { opacity: 0 }],
        ]),
      );
      A.push(
        track(dark, TOTAL, [
          [1650, { opacity: 0.5 }],
          [2400, { opacity: 0 }, IO],
        ]),
      );
      A.push(
        track(phone, TOTAL, [
          [3900, { opacity: 0 }],
          [4150, { opacity: 1 }],
        ]),
      );
      walk(1400, 1600);
      walk(2350, 3150);
    }
    return { A, total: TOTAL };
  }
  return { pose: (s: Pose) => P[s](), play };
}
