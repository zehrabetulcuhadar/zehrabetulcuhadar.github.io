/**
 * Açılış: "Zero'ya geri sayım".
 * 1) Siyah ekranda küçük bir terminal insan gibi yazar: ./bigbang, birkaç komik açılış satırı, ilerleme çubuğu.
 * 2) Büyük geri sayım: 3, 2, 1, 0. 0 kayarak el yazısıyla "Zero"nun o'su olur.
 * 3) Tıklama / Enter / Boşluk (ya da 5 sn bekleme): pencere imlece, imleç tek bir ışık noktasına çöker,
 *    nokta galaksinin merkezine uçar, etrafındaki tozu içine çeker ve patlar. Galaksi (3D) o an doğar.
 * "Atla" düğmesi ya da Esc doğrudan patlamaya geçer. Oturum başına bir kez oynar (bkz. Intro.astro).
 */
import type Lenis from 'lenis';
import { L } from './i18n';
import type { Galaxy } from './galaxy/scene';
import { ZERO_D, svgEl } from './zero-path';

const KEY = 'zero-intro';

interface IntroOptions {
  galaxy: Galaxy | null;
  lenis: Lenis | null;
}

/** Intro.astro'daki satır içi betik, açılışın oynayıp oynamayacağına sayfa çizilmeden karar verir. */
export const introWanted = () =>
  document.documentElement.classList.contains('boot') && !!document.getElementById('intro');

class Aborted extends Error {}

type Phase = 'type' | 'ready' | 'burst' | 'bang' | 'done';

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function runIntro({ galaxy, lenis }: IntroOptions) {
  const root = document.documentElement;
  const el = document.getElementById('intro') as HTMLElement;
  (window as unknown as { __zeroIntro: boolean }).__zeroIntro = true;
  try {
    sessionStorage.setItem(KEY, '1');
    localStorage.setItem(KEY + '-at', String(Date.now()));
  } catch {
    /* gizli sekme: her seferinde oynar */
  }

  const q = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const win = q('.zi-win');
  const log = q('.zi-log');
  const count = q('.zi-count');
  const ready = q('.zi-ready');
  const spark = q('.zi-spark');
  const flash = q('.zi-flash');
  const skipBtn = q<HTMLButtonElement>('.zi-skip');
  const canvas = q<HTMLCanvasElement>('.zi-fx');
  const ctx = canvas.getContext('2d');

  let phase: Phase = 'type';
  let aborted = false;
  let autoTimer = 0;

  // sayfanın geri kalanı açılış sırasında klavyeyle gezilemesin
  const inertEls = ['main', '.top', '#telescope', '#drawer']
    .map((s) => document.querySelector<HTMLElement>(s))
    .filter((x): x is HTMLElement => !!x);
  inertEls.forEach((x) => (x.inert = true));
  lenis?.stop();

  /* ---------- yardımcılar ---------- */
  const wait = async (ms: number) => {
    await new Promise((r) => setTimeout(r, ms));
    if (aborted) throw new Aborted();
  };
  const span = (cls: string, text = '') => {
    const s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  };
  const cursor = span('zi-cur');
  const line = (...parts: (Node | string)[]) => {
    const d = document.createElement('div');
    d.className = 'zi-line in';
    d.append(...parts);
    log.append(d);
    d.append(cursor);
    return d;
  };
  const type = async (target: HTMLElement, text: string) => {
    cursor.classList.add('solid');
    for (const ch of text) {
      target.append(ch);
      let d = rand(38, 85);
      if (ch === '/' || ch === '.') d += 50;
      if (Math.random() < 0.14) d += rand(60, 140); // ara sıra tereddüt
      await wait(d);
    }
    cursor.classList.remove('solid');
  };
  const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  const task = async (text: string, extra = '', ms = 380) => {
    const sp = span('zi-spin', SPIN[0]);
    line(span('zi-a', '›'), ` ${text}`, span('zi-m', '…'), extra ? ` ${extra}` : '', ' ', sp);
    const t0 = performance.now();
    let k = 0;
    while (performance.now() - t0 < ms) {
      sp.textContent = SPIN[k++ % SPIN.length];
      await wait(70);
    }
    const ok = span('zi-ok pop', '✓');
    sp.replaceWith(ok);
  };
  const bar = async (ms: number) => {
    const cells = innerWidth < 420 ? 16 : 22;
    const fill = span('zi-barfill');
    const rest = span('zi-barrest');
    const pct = span('zi-m');
    line(span('zi-a', '›'), ' evren ', span('zi-m', '['), fill, rest, span('zi-m', ']'), ' ', pct);
    const t0 = performance.now();
    for (;;) {
      const u = Math.min(1, (performance.now() - t0) / ms);
      // gerçekçi: hızlı başlar, %87'de bir an takılır, sonra tamamlanır
      const v = u < 0.55 ? easeInOut(u / 0.55) * 0.87 : u < 0.78 ? 0.87 : 0.87 + easeInOut((u - 0.78) / 0.22) * 0.13;
      const n = Math.round(v * cells);
      fill.textContent = '█'.repeat(n);
      rest.textContent = '░'.repeat(cells - n);
      pct.textContent = `${String(Math.round(v * 100)).padStart(3, ' ')}%`;
      if (u >= 1) break;
      await wait(32);
    }
    pct.className = 'zi-ok pop';
    pct.textContent = '100% ✓';
  };

  /* ---------- efekt tuvali ---------- */
  type P = { x: number; y: number; r: number; a: number; c: string; s: number; d: number; v: number };
  let parts: P[] = [];
  let trail: { x: number; y: number; t: number }[] = [];
  let fxRaf = 0;
  const fitCanvas = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fitCanvas();
  addEventListener('resize', fitCanvas);
  const COLORS = ['#ffffff', '#ffe7b0', '#f5c45e', '#f28ac0', '#cdb8ff'];

  /* ---------- 1) terminal yazıyor ---------- */
  const play = async () => {
    win.animate(
      [
        { opacity: 0, transform: 'translateY(14px) scale(.965)', filter: 'blur(8px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
      ],
      { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    );
    const cmd = span('zi-cmd');
    line(span('zi-u', 'zero@galaxy'), span('zi-p', ':~$'), ' ', cmd);
    await wait(700);
    await type(cmd, './bigbang');
    await wait(260);
    await task(L('yıldız tozu toplanıyor'), '', 360);
    await task(L('yerçekimi derleniyor'), '', 320);
    await task(L('kahve yükleniyor'), '☕', 420);
    await bar(640);
    await wait(240);
    line(span('zi-a', '›'), span('zi-m', L(' ateşleme ')), 'T-');
    await wait(180);

    /* ---------- 2) geri sayım ---------- */
    log.classList.add('dim');
    cursor.remove();
    let prev: HTMLElement | null = null;
    for (const n of [3, 2, 1, 0]) {
      if (prev) {
        const p: HTMLElement = prev;
        p.animate(
          [
            { opacity: 1, transform: 'none', filter: 'blur(0)' },
            { opacity: 0, transform: 'translateY(-14px) scale(.55)', filter: 'blur(10px)' },
          ],
          { duration: 220, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' },
        ).onfinish = () => p.remove();
        await wait(70);
      }
      const d = span('zi-digit', String(n));
      count.append(d);
      d.animate(
        [
          { opacity: 0, transform: 'scale(2.3)', filter: 'blur(16px)' },
          { opacity: 1, transform: 'scale(.93)', filter: 'blur(0)', offset: 0.62 },
          { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' },
        ],
        { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' },
      );
      const ring = span('zi-ring');
      count.append(ring);
      ring.animate(
        [
          { opacity: 0.85, transform: 'scale(.35)' },
          { opacity: 0, transform: 'scale(1.9)' },
        ],
        { duration: 700, delay: 140, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'both' },
      ).onfinish = () => ring.remove();
      // her rakamda pencere hafifçe "güm" eder
      win.animate([{ transform: 'none' }, { transform: 'translateY(2px) scale(.994)' }, { transform: 'none' }], {
        duration: 260,
        delay: 160,
        easing: 'ease-out',
        composite: 'add',
      });
      prev = d;
      await wait(n === 0 ? 420 : 470);
    }

    /* ---------- 0 → Zero ---------- */
    // "Zero" tek bir kalem çizgisiyle, el yazısı gibi yazılır; 0 küçülüp sondaki o'nun içine oturur
    const zero = prev!;
    const word = svgEl('svg', { viewBox: '0 0 260 120', class: 'zi-word' });
    const pen = svgEl('path', { d: ZERO_D, pathLength: 1, class: 'zi-pen' });
    word.append(pen);
    count.append(word);
    const zr = zero.getBoundingClientRect();
    const wr0 = word.getBoundingClientRect();
    const ox = wr0.left + (wr0.width * 213) / 260,
      oy = wr0.top + (wr0.height * 76) / 120;
    const dx = ox - (zr.left + zr.width / 2),
      dy = oy - (zr.top + zr.height / 2);
    const sc = (wr0.height * 0.36) / (zr.height * 0.72);
    zero.animate(
      [
        { transform: 'none', opacity: 1, filter: 'blur(0)' },
        { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 0.9, filter: 'blur(0)', offset: 0.8 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sc})`, opacity: 0, filter: 'blur(1px)' },
      ],
      { duration: 900, easing: 'cubic-bezier(.6,0,.2,1)', fill: 'forwards' },
    );
    pen.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], {
      duration: 1050,
      delay: 60,
      easing: 'cubic-bezier(.45,.05,.3,1)',
      fill: 'both',
    });
    pen.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, delay: 60, fill: 'both' });
    word.animate(
      [{ filter: 'brightness(1)' }, { filter: 'brightness(1.5)', offset: 0.6 }, { filter: 'brightness(1)' }],
      { duration: 900, delay: 700, easing: 'ease-out' },
    );
    await wait(1120);
    zero.remove();
    // küçük parıltılar
    const wr = word.getBoundingClientRect();
    const cr = count.getBoundingClientRect();
    [
      [0.02, 0.18, 1],
      [0.97, 0.3, 0.8],
      [0.9, 0.9, 0.6],
      [0.12, 0.92, 0.7],
    ].forEach(([fx, fy, s], i) => {
      const st = span('zi-sparkle', '✦');
      st.style.left = `${wr.left - cr.left + wr.width * fx - 9}px`;
      st.style.top = `${wr.top - cr.top + wr.height * fy - 9}px`;
      count.append(st);
      st.animate(
        [
          { opacity: 0, transform: `scale(0) rotate(0deg)` },
          { opacity: 1, transform: `scale(${s}) rotate(90deg)`, offset: 0.4 },
          { opacity: 0, transform: `scale(0) rotate(180deg)` },
        ],
        { duration: 900, delay: i * 90, easing: 'ease-out', fill: 'both' },
      );
    });

    /* ---------- 3) bekleyen istem ---------- */
    await wait(220);
    ready.append(span('zi-u', 'zero@galaxy'), span('zi-p', ':~$'), ' ', cursor);
    ready.classList.add('zi-line', 'in');
    phase = 'ready';
    el.classList.add('ready');
    // tıklamaya gerek yok: yazı bir an parlar, sonra kendiliğinden patlamaya geçer
    autoTimer = window.setTimeout(() => burst(), 750);
  };

  /* ---------- alternatif açılış: "bigbang" bombası ---------- */
  // Kilden bir bomba düğmesi. Sahte bir imleç gelip tıklar, "Zero" şeklindeki fitil yanar, bomba patlar.
  let ignite: (() => void) | null = null;
  const playBomb = async () => {
    win.style.display = 'none';
    const FUSE = `${ZERO_D} C 262 66, 300 64, 306 96 C 311 124, 286 140, 276 166`;
    const VW = 330,
      VH = 310,
      BX = 232,
      BY = 232;
    const zb = document.createElement('div');
    zb.className = 'zb';
    const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}` });
    svg.innerHTML = `
      <defs>
        <radialGradient id="zb-body" cx="36%" cy="30%" r="80%">
          <stop offset="0" stop-color="#7a6699"/><stop offset=".55" stop-color="#3d2f58"/><stop offset="1" stop-color="#221a33"/>
        </radialGradient>
        <linearGradient id="zb-cap" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffe19a"/><stop offset="1" stop-color="#d9942b"/>
        </linearGradient>
      </defs>
      <path class="zb-ash" d="${FUSE}"/>
      <path class="zb-rope" d="${FUSE}"/>
      <path class="zb-twist" d="${FUSE}"/>
      <path class="zb-ember" d="${FUSE}"/>
      <g class="zb-bomb" tabindex="0" role="button" aria-label="bigbang">
        <g class="zb-squish">
          <ellipse cx="${BX}" cy="${BY + 70}" rx="54" ry="7" class="zb-shadow"/>
          <rect x="262" y="160" width="30" height="24" rx="6" transform="rotate(40 277 172)" fill="url(#zb-cap)"/>
          <circle cx="${BX}" cy="${BY}" r="66" fill="url(#zb-body)"/>
          <circle cx="${BX}" cy="${BY}" r="66" class="zb-hot"/>
          <ellipse cx="${BX - 26}" cy="${BY - 32}" rx="20" ry="11" transform="rotate(-38 ${BX - 26} ${BY - 32})" class="zb-shine"/>
          <circle cx="${BX - 44}" cy="${BY - 8}" r="4" class="zb-shine"/>
          <text x="${BX}" y="${BY + 12}" text-anchor="middle" transform="rotate(-7 ${BX} ${BY})" class="zb-label">bigbang</text>
          <path d="M${BX - 38} ${BY + 24} q 38 14 76 -6" class="zb-under"/>
        </g>
      </g>`;
    const fire = document.createElement('i');
    fire.className = 'zb-fire';
    const mouse = document.createElement('i');
    mouse.className = 'zb-mouse';
    mouse.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M5 2.5 L5 19 L9.4 15 L12.4 21.6 L15.2 20.3 L12.3 13.9 L18.4 13.6 Z" fill="#fff" stroke="#1b1828" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    zb.append(svg, fire, mouse);
    el.append(zb);
    let S = 1,
      left = 0,
      top = 0;
    const place = () => {
      S = Math.min(1.5, (innerWidth - 24) / VW, (innerHeight - 96) / VH);
      const w = VW * S,
        h = VH * S;
      const sp = sunPoint();
      left = Math.max(12, Math.min(innerWidth - w - 12, sp.x - BX * S));
      top = Math.max(60, Math.min(innerHeight - h - 20, sp.y - BY * S));
      zb.style.cssText = `left:${left}px;top:${top}px;width:${w}px;height:${h}px`;
    };
    place();
    addEventListener('resize', place);
    // kamera ilk karelerde yerine oturur: bomba, galaksinin doğacağı noktayı izlesin
    const settle = setInterval(place, 90);
    setTimeout(() => clearInterval(settle), 1100);
    const at = (x: number, y: number) => ({ x: left + x * S, y: top + y * S });

    const rope = svg.querySelector<SVGPathElement>('.zb-rope')!;
    const twist = svg.querySelector<SVGPathElement>('.zb-twist')!;
    const ash = svg.querySelector<SVGPathElement>('.zb-ash')!;
    const ember = svg.querySelector<SVGPathElement>('.zb-ember')!;
    const bomb = svg.querySelector<SVGGElement>('.zb-bomb')!;
    const squish = svg.querySelector<SVGGElement>('.zb-squish')!;
    const hot = svg.querySelector<SVGCircleElement>('.zb-hot')!;
    const L = rope.getTotalLength();
    [rope, twist].forEach((p) => (p.style.strokeDasharray = `${L} ${L}`));
    ash.style.strokeDasharray = `0 ${L}`;
    ember.style.strokeDasharray = `0 ${L}`;

    zb.animate(
      [
        { opacity: 0, transform: 'translateY(16px) scale(.94)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
    );
    // fitil kalemle çiziliyormuş gibi bombadan dışarı uzanır
    const grow = [rope, twist].map((p) =>
      p.animate([{ strokeDashoffset: -L }, { strokeDashoffset: 0 }], {
        duration: 900,
        delay: 200,
        easing: 'cubic-bezier(.5,0,.2,1)',
        fill: 'both',
      }),
    );

    type Sp = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number };
    let sparks: Sp[] = [];
    let lit = false;
    let burnRaf = 0;
    const burn = () => {
      if (lit || phase !== 'type') return;
      lit = true;
      grow.forEach((a) => a.cancel());
      bomb.classList.add('lit');
      fire.style.opacity = '1';
      const dur = 2900;
      const t0 = performance.now();
      let last = t0;
      const step = (now: number) => {
        if (phase !== 'type') {
          ctx?.clearRect(0, 0, innerWidth, innerHeight);
          return;
        }
        const u = Math.min(1, (now - t0) / dur);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        // yanma hızı: başta yavaş, sona doğru hızlanır
        const len = L * (u * 0.55 + u * u * 0.45);
        const pt = rope.getPointAtLength(len);
        [rope, twist].forEach((p) => (p.style.strokeDashoffset = String(-len)));
        ash.style.strokeDasharray = `${len} ${L}`;
        const seg = Math.min(len, 46);
        ember.style.strokeDasharray = `${seg} ${L}`;
        ember.style.strokeDashoffset = String(-(len - seg));
        const P = at(pt.x, pt.y);
        fire.style.transform = `translate(${pt.x * S}px, ${pt.y * S}px) scale(${0.85 + Math.random() * 0.5}) rotate(${Math.random() * 90}deg)`;
        for (let k = 0; k < 2; k++)
          sparks.push({
            x: P.x,
            y: P.y,
            vx: rand(-90, 90),
            vy: rand(-170, -20),
            t: 0,
            life: rand(0.3, 0.75),
            c: COLORS[(Math.random() * COLORS.length) | 0],
            s: rand(0.8, 2.2),
          });
        if (ctx) {
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          ctx.globalCompositeOperation = 'lighter';
          sparks = sparks.filter((p) => (p.t += dt) < p.life);
          sparks.forEach((p) => {
            p.vy += 420 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.globalAlpha = 1 - p.t / p.life;
            ctx.strokeStyle = p.c;
            ctx.lineWidth = p.s;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        if (u < 1) {
          burnRaf = requestAnimationFrame(step);
          return;
        }
        // fitil bitti: bomba içten ısınır, titrer ve patlar
        fire.style.opacity = '0';
        hot.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 430, easing: 'ease-in', fill: 'forwards' });
        squish.animate(
          [
            { transform: 'scale(1)' },
            { transform: 'scale(1.05) rotate(-2deg)' },
            { transform: 'scale(1.02) rotate(2deg)' },
            { transform: 'scale(1.1) rotate(-3deg)' },
            { transform: 'scale(1.07) rotate(3deg)' },
            { transform: 'scale(1.22)' },
          ],
          { duration: 450, easing: 'ease-in', fill: 'forwards' },
        ).onfinish = () => {
          if (phase !== 'type') return;
          const c = at(BX, BY);
          removeEventListener('resize', place);
          bang(c.x, c.y);
        };
      };
      burnRaf = requestAnimationFrame(step);
    };
    ignite = burn;
    bomb.addEventListener('click', (e) => {
      e.stopPropagation();
      press();
    });
    const press = () => {
      if (lit) return;
      squish.animate([{ transform: 'scale(1)' }, { transform: 'scale(.93)' }, { transform: 'scale(1)' }], {
        duration: 260,
        easing: 'cubic-bezier(.3,1.6,.5,1)',
      });
      burn();
    };

    // sahte imleç: sağ alttan süzülür, bombanın üzerine gelir, tıklar
    await wait(1150);
    if (lit) return;
    const from = { x: VW + 30, y: VH + 10 },
      to = { x: BX + 18, y: BY + 26 };
    const mv = mouse.animate(
      [
        { transform: `translate(${from.x * S}px, ${from.y * S}px)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${(to.x + 46) * S}px, ${(to.y + 60) * S}px)`, opacity: 1, offset: 0.62 },
        { transform: `translate(${to.x * S}px, ${to.y * S}px)`, opacity: 1 },
      ],
      { duration: 1250, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' },
    );
    await mv.finished;
    if (aborted) throw new Aborted();
    bomb.classList.add('hover');
    await wait(420);
    mouse.firstElementChild?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.8)' }, { transform: 'scale(1)' }],
      { duration: 240, easing: 'ease-out' },
    );
    const ring = document.createElement('i');
    ring.className = 'zb-click';
    ring.style.transform = `translate(${to.x * S}px, ${to.y * S}px)`;
    zb.append(ring);
    await wait(110);
    press();
    await wait(500);
    mouse.animate(
      [
        { transform: `translate(${to.x * S}px, ${to.y * S}px)`, opacity: 1 },
        { transform: `translate(${(to.x + 70) * S}px, ${(to.y + 50) * S}px)`, opacity: 0 },
      ],
      { duration: 700, easing: 'ease-in', fill: 'forwards' },
    );
  };

  /* ---------- varsayılan açılış: IDE'de bomba düğmesi yazılır ---------- */
  // Kod hızla yazılır, yandaki önizlemede düğme canlı canlı bombaya dönüşür. Terminal derler,
  // sahte bir imleç gelip tıklar, "Zero" şeklindeki fitil yanar; pencere bombanın içine çöker ve Big Bang.
  const playIde = async () => {
    win.style.display = 'none';
    const en = document.documentElement.lang === 'en';
    const FUSE = `${ZERO_D} C 262 66, 300 64, 306 96 C 311 124, 286 140, 276 166`;
    const ide = document.createElement('div');
    ide.className = 'ide';
    ide.innerHTML = `
      <div class="ide-bar">
        <span class="zi-dots"><i></i><i></i><i></i></span>
        <span class="ide-tab on"><b>TSX</b>Bomb.tsx<i class="ide-dirty"></i></span>
        <span class="ide-tab ide-tab2"><b>TS</b>galaxy.ts</span>
        <span class="ide-run">▶ run</span>
      </div>
      <div class="ide-main">
        <div class="ide-code"><ol></ol></div>
        <div class="ide-view">
          <span class="ide-view-h"><i></i>${en ? 'live preview' : 'canlı önizleme'}</span>
          <div class="ide-stage">
            <svg viewBox="0 0 330 310"><path class="zb-ash" d="${FUSE}"/><path class="zb-rope" d="${FUSE}"/><path class="zb-ember" d="${FUSE}"/></svg>
            <i class="ide-cap"></i>
            <div class="ide-bomb" role="button" tabindex="-1"><span>bigbang</span></div>
            <i class="zb-fire"></i>
          </div>
        </div>
      </div>
      <div class="ide-term"><div class="ide-log"></div></div>
      <div class="ide-status"><span>⎇ main</span><span>TypeScript JSX</span><span>UTF-8</span><span class="ide-st">☕ ${en ? 'writing…' : 'yazılıyor…'}</span></div>`;
    el.append(ide);
    const mouse = document.createElement('i');
    mouse.className = 'zb-mouse ide-mouse';
    mouse.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M5 2.5 L5 19 L9.4 15 L12.4 21.6 L15.2 20.3 L12.3 13.9 L18.4 13.6 Z" fill="#fff" stroke="#1b1828" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    el.append(mouse);
    const $i = <T extends Element>(q2: string) => ide.querySelector(q2) as T;
    const ol = $i<HTMLOListElement>('ol');
    const view = $i<HTMLElement>('.ide-view');
    const stage = $i<HTMLElement>('.ide-stage');
    const bomb = $i<HTMLElement>('.ide-bomb');
    const cap = $i<HTMLElement>('.ide-cap');
    const fire = $i<HTMLElement>('.zb-fire');
    const rope = $i<SVGPathElement>('.zb-rope');
    const ash = $i<SVGPathElement>('.zb-ash');
    const ember = $i<SVGPathElement>('.zb-ember');
    const tlog = $i<HTMLElement>('.ide-log');
    const status = $i<HTMLElement>('.ide-st');
    let S = 1;
    const fit = () => {
      S = Math.min(1.25, (view.clientWidth - 16) / 330, (view.clientHeight - 30) / 310);
      stage.style.scale = String(S);
    };
    fit();
    addEventListener('resize', fit);
    const LEN = rope.getTotalLength();
    rope.style.strokeDasharray = `${LEN} ${LEN}`;
    rope.style.strokeDashoffset = String(-LEN);
    ash.style.strokeDasharray = `0 ${LEN}`;
    ember.style.strokeDasharray = `0 ${LEN}`;
    ember.style.opacity = '0';
    ash.style.opacity = '0';

    // tıklama / Enter: yazım hızlanır (beklemek istemeyenler için)
    let speed = 1;
    const nap = (ms: number) => wait(ms * speed);
    let lit = false;
    let canPress = false;
    ignite = () => {
      if (canPress) press();
      else speed = 0.12;
    };

    ide.animate(
      [
        { opacity: 0, transform: 'translateY(16px) scale(.96)', filter: 'blur(8px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
      ],
      { duration: 560, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' },
    );
    await nap(520);

    /* --- kod yazılır --- */
    type Tok = [string, string];
    const CODE: { t: Tok[]; after?: string }[] = [
      {
        t: [
          ['k', 'export function '],
          ['f', 'Bomb'],
          ['p', '() {'],
        ],
      },
      {
        t: [
          ['k', '  return '],
          ['p', '('],
        ],
      },
      {
        t: [
          ['p', '    <'],
          ['t', 'button '],
          ['a', 'onClick'],
          ['p', '={'],
          ['f', 'bigBang'],
          ['p', '}>'],
        ],
      },
      { t: [['x', '      bigbang']] },
      {
        t: [
          ['p', '    </'],
          ['t', 'button'],
          ['p', '>'],
        ],
        after: 'btn',
      },
      { t: [['p', '  );']] },
      { t: [['p', '}']] },
      { t: [] },
      {
        t: [
          ['f', 'Bomb'],
          ['p', '.'],
          ['a', 'style'],
          ['p', ' = {'],
        ],
      },
      {
        t: [
          ['a', '  shape'],
          ['p', ': '],
          ['s', "'round'"],
          ['p', ','],
        ],
        after: 'round',
      },
      {
        t: [
          ['a', '  material'],
          ['p', ': '],
          ['s', "'clay'"],
          ['p', ','],
        ],
        after: 'clay',
      },
      {
        t: [
          ['a', '  fuse'],
          ['p', ': '],
          ['s', "'Zero'"],
          ['p', ','],
        ],
        after: 'fuse',
      },
      { t: [['p', '};']] },
    ];
    const caret = span('ide-caret');
    for (const ln of CODE) {
      const li = document.createElement('li');
      ol.append(li);
      li.append(caret);
      fit();
      for (const [cls, text] of ln.t) {
        const sp = span('c-' + cls);
        caret.before(sp);
        // zamana göre yazar: kare hızı düşse de (yavaş telefon) kod aynı sürede biter
        const t0 = performance.now();
        const per = rand(15, 21);
        for (let i = 0; i < text.length;) {
          await wait(14);
          const want = Math.min(text.length, Math.ceil((performance.now() - t0) / (per * speed)));
          if (want > i) {
            sp.append(text.slice(i, want));
            i = want;
          }
        }
      }
      if (ln.after === 'btn') {
        bomb.classList.add('s-btn');
        await nap(380);
      } else if (ln.after === 'round') {
        bomb.classList.add('s-round');
        await nap(420);
      } else if (ln.after === 'clay') {
        bomb.classList.add('s-clay');
        await nap(420);
      } else if (ln.after === 'fuse') {
        cap.classList.add('on');
        rope.animate([{ strokeDashoffset: -LEN }, { strokeDashoffset: 0 }], {
          duration: 900 * Math.max(speed, 0.3),
          easing: 'cubic-bezier(.5,0,.2,1)',
          fill: 'forwards',
        });
        await nap(760);
      } else await nap(ln.t.length ? 45 : 20);
    }
    caret.classList.add('blink');
    $i<HTMLElement>('.ide-dirty').classList.add('saved');
    status.textContent = en ? '✓ saved' : '✓ kaydedildi';

    /* --- terminal derler --- */
    const tline = (...parts: (Node | string)[]) => {
      const d = document.createElement('div');
      d.append(...parts);
      tlog.append(d);
      while (tlog.children.length > 3) tlog.firstElementChild!.remove();
      return d;
    };
    const cmd = span('zi-cmd');
    tline(span('zi-u', 'zero@galaxy'), span('zi-p', ':~$'), ' ', cmd);
    await nap(200);
    {
      const text = 'npm run bigbang';
      const t0 = performance.now();
      for (let i = 0; i < text.length;) {
        await wait(14);
        const want = Math.min(text.length, Math.ceil((performance.now() - t0) / (34 * speed)));
        if (want > i) {
          cmd.append(text.slice(i, want));
          i = want;
        }
      }
    }
    await nap(260);
    tline(
      span('zi-ok', '✓'),
      en ? ' compiled in 0.42s · 0 errors, 1 universe' : ' 0.42 sn’de derlendi · 0 hata, 1 evren',
    );
    bomb.classList.add('ready');
    canPress = true;
    await nap(380);

    /* --- fitil --- */
    type Sp = { x: number; y: number; vx: number; vy: number; t: number; life: number; c: string; s: number };
    let sparks: Sp[] = [];
    const centre = () => {
      const r = bomb.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const burn = () => {
      rope.getAnimations().forEach((a) => a.cancel());
      bomb.classList.add('lit');
      fire.style.opacity = '1';
      ember.style.opacity = '';
      ash.style.opacity = '';
      status.textContent = en ? '🔥 running' : '🔥 çalışıyor';
      const cd = tline(span('zi-a', '›'), en ? ' ignition ' : ' ateşleme ', span('zi-m', 'T-'));
      const marks = [0.06, 0.36, 0.66, 0.95];
      let shown = 0;
      const dur = 2500;
      const t0 = performance.now();
      let last = t0;
      const step = (now: number) => {
        if (phase !== 'type') {
          ctx?.clearRect(0, 0, innerWidth, innerHeight);
          return;
        }
        const u = Math.min(1, (now - t0) / dur);
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        while (shown < 4 && u >= marks[shown]) {
          const d = span('ide-cd pop', String(3 - shown));
          cd.append(d, ' ');
          shown++;
        }
        const len = LEN * (u * 0.55 + u * u * 0.45);
        const pt = rope.getPointAtLength(len);
        rope.style.strokeDashoffset = String(-len);
        ash.style.strokeDasharray = `${len} ${LEN}`;
        const sg = Math.min(len, 46);
        ember.style.strokeDasharray = `${sg} ${LEN}`;
        ember.style.strokeDashoffset = String(-(len - sg));
        fire.style.transform = `translate(${pt.x}px, ${pt.y}px) scale(${0.85 + Math.random() * 0.5}) rotate(${Math.random() * 90}deg)`;
        const sr = stage.getBoundingClientRect();
        const px = sr.left + pt.x * S,
          py = sr.top + pt.y * S;
        for (let k = 0; k < 2; k++)
          sparks.push({
            x: px,
            y: py,
            vx: rand(-90, 90),
            vy: rand(-170, -20),
            t: 0,
            life: rand(0.3, 0.75),
            c: COLORS[(Math.random() * COLORS.length) | 0],
            s: rand(0.8, 2.2),
          });
        if (ctx) {
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          ctx.globalCompositeOperation = 'lighter';
          sparks = sparks.filter((p) => (p.t += dt) < p.life);
          sparks.forEach((p) => {
            p.vy += 420 * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            ctx.globalAlpha = 1 - p.t / p.life;
            ctx.strokeStyle = p.c;
            ctx.lineWidth = p.s;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        if (u < 1) {
          requestAnimationFrame(step);
          return;
        }
        finale();
      };
      requestAnimationFrame(step);
    };
    // fitil bitti: bomba ısınır, pencere bombanın içine çöker, ışık noktası galaksinin merkezine uçup patlar
    const finale = async () => {
      fire.style.opacity = '0';
      ignite = null;
      bomb.classList.add('hot');
      await bomb.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.06) rotate(-2deg)' },
          { transform: 'scale(1.03) rotate(2deg)' },
          { transform: 'scale(1.12) rotate(-3deg)' },
          { transform: 'scale(1.2)' },
        ],
        { duration: 420, easing: 'ease-in', fill: 'forwards' },
      ).finished;
      if (phase !== 'type') return;
      phase = 'burst';
      removeEventListener('resize', fit);
      ctx?.clearRect(0, 0, innerWidth, innerHeight);
      const c = centre();
      const ir = ide.getBoundingClientRect();
      ide.style.transformOrigin = `${c.x - ir.left}px ${c.y - ir.top}px`;
      await ide.animate(
        [
          { transform: 'none', filter: 'brightness(1)', borderRadius: '14px' },
          { transform: 'scale(1.02)', filter: 'brightness(1.15)', offset: 0.2 },
          { transform: 'scale(.012)', filter: 'brightness(3)', borderRadius: '50%' },
        ],
        { duration: 400, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' },
      ).finished;
      if (phase !== 'burst') return;
      ide.remove();
      spark.style.opacity = '1';
      spark.style.borderRadius = '50%';
      placeSpark(c.x, c.y, 5, 5);
      const s = sunPoint();
      await flyTo(c.x, c.y, s.x, s.y, 520);
      if (phase !== 'burst') return;
      await implode(s.x, s.y, 560);
      if (phase !== 'burst') return;
      bang(s.x, s.y);
    };
    const press = () => {
      if (lit || phase !== 'type') return;
      lit = true;
      bomb.animate([{ transform: 'scale(1)' }, { transform: 'scale(.92)' }, { transform: 'scale(1)' }], {
        duration: 260,
        easing: 'cubic-bezier(.3,1.6,.5,1)',
      });
      burn();
    };
    bomb.addEventListener('click', (e) => {
      e.stopPropagation();
      press();
    });

    /* --- sahte imleç gelir, tıklar --- */
    if (lit) return;
    const ir = ide.getBoundingClientRect();
    const c0 = centre();
    const to = { x: c0.x + 14 * S, y: c0.y + 22 * S };
    const from = { x: ir.left + ir.width * 0.3, y: ir.bottom + 30 };
    const mv = mouse.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px)`, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: `translate(${to.x - 60}px, ${to.y + 70}px)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${to.x}px, ${to.y}px)`, opacity: 1 },
      ],
      { duration: 1050 * Math.max(speed, 0.4), easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' },
    );
    await mv.finished;
    if (aborted) throw new Aborted();
    bomb.classList.add('hover');
    await nap(330);
    mouse.firstElementChild?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(.8)' }, { transform: 'scale(1)' }],
      { duration: 240, easing: 'ease-out' },
    );
    const ring = document.createElement('i');
    ring.className = 'zb-click ide-mouse';
    ring.style.transform = `translate(${to.x}px, ${to.y}px)`;
    el.append(ring);
    await wait(110);
    press();
    await wait(450);
    mouse.animate(
      [
        { transform: `translate(${to.x}px, ${to.y}px)`, opacity: 1 },
        { transform: `translate(${to.x + 80}px, ${to.y + 60}px)`, opacity: 0 },
      ],
      { duration: 600, easing: 'ease-in', fill: 'forwards' },
    );
  };

  /* ---------- 4) çöküş → uçuş → içe çekiş → patlama ---------- */
  const sunPoint = () => {
    const p = galaxy?.sunPoint();
    return p && Number.isFinite(p.x) ? p : { x: innerWidth / 2, y: innerHeight / 2 };
  };
  const placeSpark = (x: number, y: number, w: number, h: number, extra = '') => {
    spark.style.width = `${w}px`;
    spark.style.height = `${h}px`;
    spark.style.transform = `translate(${x - w / 2}px, ${y - h / 2}px) ${extra}`;
  };

  const burst = async () => {
    if (ignite) {
      ignite();
      return;
    }
    if (phase !== 'ready') return;
    phase = 'burst';
    clearTimeout(autoTimer);
    el.classList.remove('ready');
    el.classList.add('gone');
    const hint = q('.zi-hint');
    hint.style.transition = 'opacity .15s';
    hint.style.opacity = '0';

    // a) pencere imlecin içine çekilir
    cursor.classList.add('solid');
    const wr = win.getBoundingClientRect();
    const cr = cursor.getBoundingClientRect();
    const cx = cr.left + cr.width / 2,
      cy = cr.top + cr.height / 2;
    win.style.opacity = '1';
    win.style.transformOrigin = `${cx - wr.left}px ${cy - wr.top}px`;
    const inner = [q('.zi-titlebar'), log, count, ...[...ready.children].filter((x) => x !== cursor)] as HTMLElement[];
    inner.forEach((x) =>
      x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-in', fill: 'forwards' }),
    );
    await win.animate(
      [
        { transform: 'none', borderRadius: '14px', background: '#110e19', offset: 0 },
        { transform: 'scale(1.015)', offset: 0.18 },
        { background: '#1a1426', offset: 0.7 },
        {
          transform: `scale(${cr.width / wr.width}, ${cr.height / wr.height})`,
          borderRadius: '2px',
          background: '#fbe9f3',
        },
      ],
      { duration: 380, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' },
    ).finished;
    if (phase !== 'burst') return;
    win.style.visibility = 'hidden';

    // b) imleç CRT gibi önce yatay bir çizgiye, sonra tek bir noktaya çöker
    spark.style.opacity = '1';
    const cw = cr.width,
      ch = cr.height;
    await spark.animate(
      [
        {
          width: `${cw}px`,
          height: `${ch}px`,
          transform: `translate(${cx - cw / 2}px, ${cy - ch / 2}px)`,
          borderRadius: '2px',
        },
        {
          width: '34px',
          height: '2px',
          transform: `translate(${cx - 17}px, ${cy - 1}px)`,
          borderRadius: '2px',
          offset: 0.45,
        },
        { width: '5px', height: '5px', transform: `translate(${cx - 2.5}px, ${cy - 2.5}px)`, borderRadius: '50%' },
      ],
      { duration: 230, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' },
    ).finished;
    if (phase !== 'burst') return;
    spark.getAnimations().forEach((a) => a.cancel());
    spark.style.borderRadius = '50%';
    placeSpark(cx, cy, 5, 5);

    // c) nokta kavis çizerek galaksinin merkezine uçar, arkasında ince bir iz bırakır
    const s = sunPoint();
    await flyTo(cx, cy, s.x, s.y, 520);
    if (phase !== 'burst') return;

    // d) titrer, çevresindeki tozu içine çeker
    await implode(s.x, s.y, 560);
    if (phase !== 'burst') return;
    bang(s.x, s.y);
  };

  const flyTo = (x0: number, y0: number, x1: number, y1: number, ms: number) =>
    new Promise<void>((res) => {
      const dx = x1 - x0,
        dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      // kontrol noktası: yolun ortasından dik yönde, hafif bir yay
      const bend = Math.min(140, len * 0.45);
      const mx = (x0 + x1) / 2 - (dy / len) * bend,
        my = (y0 + y1) / 2 + (dx / len) * bend * 0.6 - bend * 0.4;
      const t0 = performance.now();
      const step = (now: number) => {
        const u = Math.min(1, (now - t0) / ms);
        const e = easeInOut(u);
        const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * mx + e * e * x1;
        const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * my + e * e * y1;
        trail.push({ x, y, t: now });
        placeSpark(x, y, 5, 5, `scale(${1 + Math.sin(u * Math.PI) * 0.6})`);
        drawFx(now);
        if (u < 1 && phase === 'burst') requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });

  const implode = (x: number, y: number, ms: number) =>
    new Promise<void>((res) => {
      const R = Math.max(innerWidth, innerHeight);
      const N = innerWidth < 600 ? 70 : 120;
      for (let i = 0; i < N; i++)
        parts.push({
          x,
          y,
          a: Math.random() * Math.PI * 2,
          r: rand(R * 0.12, R * 0.55),
          c: COLORS[(Math.random() * COLORS.length) | 0],
          s: rand(0.6, 1.8),
          d: rand(0, 0.35), // gecikme (0-1 arası, süreye göre)
          v: rand(0.8, 1.3),
        });
      const ring = document.createElement('div');
      ring.className = 'zi-shock';
      el.append(ring);
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      ring.animate(
        [
          { opacity: 0, transform: 'scale(4)', borderColor: 'rgba(242,138,192,.5)' },
          { opacity: 0.55, transform: 'scale(1.2)', offset: 0.6 },
          { opacity: 0, transform: 'scale(.05)' },
        ],
        { duration: ms, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' },
      ).onfinish = () => ring.remove();
      const t0 = performance.now();
      const step = (now: number) => {
        const u = Math.min(1, (now - t0) / ms);
        const jx = rand(-1, 1) * (0.6 + u * 2.6),
          jy = rand(-1, 1) * (0.6 + u * 2.6);
        const sz = 5 + u * 7;
        placeSpark(x + jx, y + jy, sz, sz);
        spark.style.boxShadow = `0 0 ${6 + u * 14}px ${2 + u * 5}px #fff, 0 0 ${22 + u * 40}px ${6 + u * 14}px rgba(242,138,192,.85), 0 0 ${60 + u * 80}px ${18 + u * 30}px rgba(245,196,94,.45)`;
        drawFx(now, (p) => {
          const k = Math.max(0, Math.min(1, (u - p.d) / (1 - p.d)));
          const e = Math.pow(k, 2.2 * p.v);
          return { r: p.r * (1 - e), on: k > 0 && k < 1 };
        });
        if (u < 1 && phase === 'burst') requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });

  /** Tuvale iz ve parçacıkları çizer. `pull` verildiğinde parçacıklar merkeze doğru çekilir. */
  const drawFx = (now: number, pull?: (p: P) => { r: number; on: boolean }) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    // iz
    trail = trail.filter((p) => now - p.t < 260);
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1],
        b = trail[i];
      const life = 1 - (now - b.t) / 260;
      ctx.strokeStyle = `rgba(255, 214, 236, ${life * 0.9})`;
      ctx.lineWidth = 1 + life * 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    if (pull)
      parts.forEach((p) => {
        const { r, on } = pull(p);
        if (!on) return;
        const ca = Math.cos(p.a),
          sa = Math.sin(p.a);
        const tail = Math.min(46, (p.r - r) * 0.22 + 2);
        const x = p.x + ca * r,
          y = p.y + sa * r;
        const g = ctx.createLinearGradient(x, y, x + ca * tail, y + sa * tail);
        g.addColorStop(0, p.c);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = g;
        ctx.lineWidth = p.s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + ca * tail, y + sa * tail);
        ctx.stroke();
      });
    ctx.globalCompositeOperation = 'source-over';
  };

  /** Dışa saçılan kıvılcımlar (patlama anı). */
  const scatter = (x: number, y: number) => {
    if (!ctx) return;
    const N = innerWidth < 600 ? 50 : 90;
    const ps = Array.from({ length: N }, () => ({
      a: Math.random() * Math.PI * 2,
      v: rand(250, 1100),
      s: rand(0.8, 2.4),
      c: COLORS[(Math.random() * COLORS.length) | 0],
    }));
    const t0 = performance.now();
    const step = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      if (t > 1.1) return;
      ctx.globalCompositeOperation = 'lighter';
      ps.forEach((p) => {
        const d = p.v * (1 - Math.exp(-t * 3.2)) * 0.32;
        const ca = Math.cos(p.a),
          sa = Math.sin(p.a);
        const life = Math.max(0, 1 - t / 1.1);
        ctx.strokeStyle = p.c;
        ctx.globalAlpha = life;
        ctx.lineWidth = p.s;
        ctx.beginPath();
        ctx.moveTo(x + ca * d, y + sa * d);
        ctx.lineTo(x + ca * (d + 4 + p.v * 0.02 * life), y + sa * (d + 4 + p.v * 0.02 * life));
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      fxRaf = requestAnimationFrame(step);
    };
    fxRaf = requestAnimationFrame(step);
  };

  /* ---------- 5) BANG ---------- */
  const bang = (x: number, y: number) => {
    if (phase === 'bang' || phase === 'done') return;
    phase = 'bang';
    clearTimeout(autoTimer);
    el.classList.add('gone');
    el.style.pointerEvents = 'none';
    galaxy?.bigBang();
    spark.style.opacity = '0';
    parts = [];
    trail = [];
    flash.style.setProperty('--fx', `${x}px`);
    flash.style.setProperty('--fy', `${y}px`);
    flash.animate(
      [{ opacity: 0, offset: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }],
      { duration: 1100, easing: 'cubic-bezier(.2,.6,.3,1)', fill: 'forwards' },
    );
    // siyah perde, flaşın arkasında kalkar
    el.animate([{ backgroundColor: '#040308' }, { backgroundColor: 'rgba(4,3,8,0)' }], {
      duration: 220,
      delay: 40,
      easing: 'ease-out',
      fill: 'forwards',
    });
    el.style.background = 'transparent';
    q('.zi-stage').style.display = 'none';
    el.querySelectorAll('.zb, .ide, .ide-mouse').forEach((x) => x.remove());
    // şok halkaları
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) / 50;
    [0, 110, 240].forEach((delay, i) => {
      const ring = document.createElement('div');
      ring.className = 'zi-shock';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      if (i === 1) ring.style.borderWidth = '1px';
      if (i === 2) ring.style.borderColor = 'rgba(242,138,192,.9)';
      el.append(ring);
      ring.animate(
        [
          { opacity: 1, transform: 'scale(.1)', borderWidth: i ? '1px' : '3px' },
          { opacity: 0, transform: `scale(${R * (1 - i * 0.18)})`, borderWidth: '1px' },
        ],
        { duration: 1100 + i * 150, delay, easing: 'cubic-bezier(.1,.6,.2,1)', fill: 'both' },
      ).onfinish = () => ring.remove();
    });
    scatter(x, y);
    // yazılar belirir (bkz. index.astro .intro)
    setTimeout(() => root.classList.remove('intro'), 650);
    setTimeout(finish, 1500);
  };

  const finish = () => {
    if (phase === 'done') return;
    phase = 'done';
    cancelAnimationFrame(fxRaf);
    removeEventListener('resize', fitCanvas);
    removeEventListener('keydown', onKey, true);
    root.classList.remove('boot', 'intro');
    inertEls.forEach((x) => (x.inert = false));
    if (el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    el.remove();
    lenis?.start();
  };

  /** Atla: terminal sönümlenir, nokta doğrudan merkezde belirir ve kısa bir içe çekişten sonra patlar. */
  const skip = async () => {
    if (phase === 'bang' || phase === 'done') return;
    if (phase === 'burst') {
      aborted = true;
      bang(sunPoint().x, sunPoint().y);
      return;
    }
    aborted = true;
    phase = 'burst';
    clearTimeout(autoTimer);
    el.classList.remove('ready');
    el.classList.add('gone');
    el.querySelectorAll('.zb, .ide, .ide-mouse').forEach((x) =>
      x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 240, fill: 'forwards' }),
    );
    q('.zi-stage').animate(
      [
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
        { opacity: 0, transform: 'scale(.94)', filter: 'blur(6px)' },
      ],
      { duration: 240, easing: 'ease-in', fill: 'forwards' },
    );
    const s = sunPoint();
    spark.style.borderRadius = '50%';
    placeSpark(s.x, s.y, 5, 5);
    spark.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, fill: 'forwards' });
    await implode(s.x, s.y, 340);
    bang(s.x, s.y);
  };

  /* ---------- girdiler ---------- */
  const onKey = (e: KeyboardEvent) => {
    if (phase === 'bang' || phase === 'done') return;
    if (e.key === 'Escape') {
      e.preventDefault();
      skip();
      return;
    }
    if (e.target === skipBtn && (e.key === 'Enter' || e.key === ' ')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      burst();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(e.key)) e.preventDefault();
  };
  addEventListener('keydown', onKey, true);
  skipBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    skip();
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation(); // galaksinin tıklama dinleyicisine (güneş = tema) ulaşmasın
    burst();
  });
  el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
  el.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

  // sayfa geri yüklenen bir kaydırma konumuyla açıldıysa açılışı hemen bırak
  const scrolled = () => scrollY > innerHeight * 0.5;
  const abortIfScrolled = () => {
    if (!scrolled() || phase !== 'type') return;
    aborted = true;
    galaxy?.endIntro();
    finish();
  };
  addEventListener('scroll', abortIfScrolled, { passive: true, once: true });
  setTimeout(() => removeEventListener('scroll', abortIfScrolled), 1200);

  if (scrolled()) {
    galaxy?.endIntro();
    finish();
    return;
  }
  (root.classList.contains('bomb') ? playBomb : root.classList.contains('term') ? play : playIde)().catch((e) => {
    if (!(e instanceof Aborted)) {
      console.error(e);
      skip();
    }
  });
}
