import { L, lang, setLang, translate } from './i18n';
import { themeScene } from './theme-switch';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { Galaxy, type Theme } from './galaxy/scene';
import type { PlanetBody } from './galaxy/planets';
import { confetti } from './galaxy/effects';
import { birthday, playlists, posts, topics } from '../data/site';
import { ScopeIntro } from './galaxy/scope3d';
import { introWanted, runIntro } from './intro';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fmtDate = (d: string, l: string = lang, long = false) =>
  d
    ? new Date(d + 'T12:00:00').toLocaleDateString(l === 'en' ? 'en-GB' : 'tr-TR', {
        day: 'numeric',
        month: long ? 'long' : 'short',
        year: 'numeric',
      })
    : '';
const fmtMin = (m: number, l: string = lang) => (l === 'en' ? `${m} min read` : `${m} dk okuma`);
/** Yazı satırının küçük üst yazısı: tarih ve okuma süresi. */
const postMeta = (p: (typeof posts)[number]) =>
  p.demo ? (lang === 'en' ? 'demo star' : 'deneme yıldızı') : `${fmtDate(p.date)} · ${fmtMin(p.min)}`;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
root.classList.add('anim');

/* ---------- yumuşak kaydırma ---------- */
// Kart ya da çekmece kendi içinde kaydırılabiliyorsa tekerlek önce onu kaydırır; sonuna gelince sayfa devam eder.
const innerScroll = (target: EventTarget | null, dy: number) => {
  const el = (target as Element | null)?.closest?.('.panel-in, #drawer-body, .reader-scroll, .hud-chips');
  if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
  return dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
};
const lenis = reduce
  ? null
  : new Lenis({
      lerp: 0.1,
      wheelMultiplier: 0.85,
      virtualScroll: (d) => !root.classList.contains('locked') && !innerScroll(d.event.target, d.deltaY),
    });
if (lenis) {
  const raf = (t: number) => {
    lenis.raf(t);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/* ---------- açılış ---------- */
// Oturumun ilk ziyareti: terminal açılışı (intro.ts) Big Bang'i kendisi tetikler.
// Sonraki ziyaretlerde sadece kısa 3D Big Bang oynar, bitince yazılar belirir.
const booting = introWanted();
// Dil değişince sayfa yeniden kurulur; kaldığın yer (bölüm, açık gezegen, serbest gezinti) geri gelir.
const swap = (() => {
  try {
    const v = sessionStorage.getItem('zero-swap');
    sessionStorage.removeItem('zero-swap');
    return v ? (JSON.parse(v) as { y: number; planet: number; explore: boolean }) : null;
  } catch {
    return null;
  }
})();
const shortIntro = !booting && !reduce && !swap && scrollY < innerHeight * 0.5;
if (!booting) document.getElementById('intro')?.remove();
if (shortIntro) {
  root.classList.add('intro');
  setTimeout(() => root.classList.remove('intro'), 1900);
}

/* ---------- tema ---------- */
const applyTheme = (t: Theme) => {
  root.setAttribute('data-theme', t);
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* gizli sekme */
  }
};

/**
 * Tutulmanın tam anında bütün sayfa (yazılar, paneller, galaksi) yeni temaya
 * güneşin olduğu noktadan dairesel olarak açılır. View Transitions API ile yapılıyor;
 * desteklemeyen tarayıcıda renkler yumuşakça geçer.
 */
const reveal = (x: number, y: number, t: Theme) => {
  const swap = () => {
    applyTheme(t);
    galaxy?.setTheme(t);
    galaxy?.renderNow();
  };
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  if (reduce || !doc.startViewTransition) {
    swap();
    return;
  }
  root.classList.add('vt');
  const vt = doc.startViewTransition(swap);
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  vt.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 1300, easing: 'cubic-bezier(.65,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
      );
    })
    .catch(() => {});
  vt.finished.finally(() => root.classList.remove('vt'));
};

/* ---------- galaksi ---------- */
let galaxy: Galaxy | null = null;
const drawer = $('drawer');
let section = -1;

/* ---------- bölüm değişimi: yazılar yerinde durur, eski kart çekilir, yenisi gidilen yönden gelir ---------- */
const secEls = [...document.querySelectorAll<HTMLElement>('main > section')];
const railEls = [...document.querySelectorAll<HTMLElement>('[data-rail]')];
secEls.forEach((s) =>
  s
    .querySelectorAll<HTMLElement>('.panel-in > *, .skyhead > *')
    .forEach((el, k) => el.style.setProperty('--k', String(k))),
);
const setSection = (i: number) => {
  i = Math.max(0, Math.min(secEls.length - 1, i));
  if (i === section) return;
  root.style.setProperty('--dir', i > section ? '1' : '-1');
  const next = secEls[i];
  secEls.forEach((s) => s !== next && s.classList.remove('in', 'pre'));
  next.classList.add('pre');
  void next.offsetWidth;
  next.classList.remove('pre');
  next.classList.add('in');
  railEls.forEach((a, k) => {
    a.classList.toggle('on', k === i);
    if (k === i) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
  section = i;
  if (i !== 3) closeDrawer();
};
try {
  galaxy = new Galaxy({
    canvas: $('galaxy') as unknown as HTMLCanvasElement,
    labels: $('labels'),
    reduce,
    onPlanet: () => {},
    onInspect: (b, i, n) => showInspect(b, i, n),
    onStar: (b, j) => openReader(b.opts.char ?? '', j),
    onSection: (i) => setSection(i),
    onWave: reveal,
    holdIntro: booting,
  });
  if (shortIntro) galaxy.bigBang();
  galaxy.setTheme((root.getAttribute('data-theme') as Theme) || 'day');
  if (import.meta.env.DEV) (window as unknown as { __g: Galaxy }).__g = galaxy;
} catch {
  // WebGL yoksa sayfa metin olarak çalışmaya devam eder
}
if (booting) runIntro({ galaxy, lenis });
/* ---------- gökyüzüm: son yıldızlar ve konu sayıları ---------- */
{
  const real = posts.filter((p) => !p.demo);
  if (real.length) {
    $('sky-latest-list').innerHTML = real
      .slice(0, 3)
      .map((p) => {
        const t = topics.find((x) => x.id === p.planet);
        return `<button type="button" class="sky-post" data-read-id="${p.id}" style="--c:${t?.color ?? '#F7C548'}"><i></i><b>${esc(p.title)}</b><small>${t?.name ?? ''} · ${fmtDate(p.date)}</small></button>`;
      })
      .join('');
    $('sky-latest').hidden = false;
    $('sky-topics').innerHTML = topics
      .map((t) => {
        const n = real.filter((p) => p.planet === t.id).length;
        return `<button type="button" data-topic="${t.id}" style="--c:${t.color}"><i></i>${t.name}<small>${n} ✦</small></button>`;
      })
      .join('');
    $('sky-topics').hidden = false;
  }
  document.querySelector('.skyhead')?.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const rd = t.closest<HTMLElement>('[data-read-id]');
    if (rd) {
      const p = posts.find((x) => x.id === rd.dataset.readId);
      if (p) openReader(p.planet, posts.filter((x) => x.planet === p.planet).indexOf(p));
      return;
    }
    const tp = t.closest<HTMLElement>('[data-topic]');
    const b = tp && galaxy?.planets.find((x) => x.opts.char === tp.dataset.topic);
    if (b) galaxy?.inspect(b);
  });
}
// karşılama yazısının kapladığı yer: oradaki gezegen etiketleri gizlenir
const heroBox = () => {
  if (!galaxy) return;
  galaxy.avoid[0] = $('kinetic').getBoundingClientRect();
  const sky = document.querySelector('.skyhead');
  if (sky) galaxy.avoid[3] = sky.getBoundingClientRect();
};
addEventListener('resize', heroBox);
document.fonts?.ready.then(heroBox);
heroBox();
// galaksi kurulamasa da (WebGL yok) bölümler kaydırmayla değişsin
const syncSection = () => setSection(Math.round(scrollY / innerHeight));
addEventListener('scroll', syncSection, { passive: true });
syncSection();

/* ---------- kaydırma bırakılınca en yakın bölüme yumuşakça oturur (yarım hâlde kalmaz) ---------- */
let flying = false;
if (lenis) {
  let snapTimer = 0;
  let snapping = false;
  const snap = () => {
    if (flying || root.classList.contains('locked')) return;
    const target = Math.round(scrollY / innerHeight) * innerHeight;
    if (Math.abs(target - scrollY) < 2) return;
    snapping = true;
    lenis.scrollTo(target, {
      duration: 0.9,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      onComplete: () => (snapping = false),
    });
  };
  lenis.on('scroll', () => {
    clearTimeout(snapTimer);
    if (!snapping) snapTimer = window.setTimeout(snap, 170);
  });
  addEventListener('wheel', () => (snapping = false), { passive: true });
  addEventListener('touchstart', () => (snapping = false), { passive: true });
}

/* ---------- kaydırma kilidi: gözlemevi, inceleme, serbest gezinti ya da okuma açıkken sayfa kaymaz ---------- */
const locks = new Set<string>();
function lockScroll(key: string, on: boolean) {
  if (on) locks.add(key);
  else locks.delete(key);
  const any = locks.size > 0;
  root.classList.toggle('locked', any);
  if (any) lenis?.stop();
  else lenis?.start();
}

/* ---------- gezegen incelemesi: kamera gezegenin yanına gider, kartta yazıları ve gezinme düğmeleri var ---------- */
const KIND: Record<string, string> = {
  topic: 'Konu gezegeni',
  hobby: 'Hobilerim',
  about: 'Bölüm',
  growth: 'Bölüm',
  contact: 'Bölüm',
};
const SECTION_OF: Record<string, number> = { about: 1, growth: 2, contact: 4 };
let inspBody: PlanetBody | null = null;
/** Müzik gezegeni: Spotify çalma listeleri plak rafı olarak; seçilen plak aşağıdaki oynatıcıda açılır. */
const VINYL = ['#F28AC0', '#F7C548', '#7C8CF2', '#4FC7B8', '#F2766B', '#B79BF5', '#8FD694', '#F9A65A', '#6CC5EE'];
type Cover = { img?: string; title?: string };
const covers = new Map<string, Cover>();
try {
  Object.entries(JSON.parse(sessionStorage.getItem('pl-covers') ?? '{}') as Record<string, Cover>).forEach(([k, v]) =>
    covers.set(k, v),
  );
} catch {
  /* gizli sekme */
}
const plName = (id: string, k: number) =>
  covers.get(id)?.title ?? playlists[k]?.title ?? `${lang === 'en' ? 'Playlist' : 'Çalma listesi'} ${k + 1}`;
/** Plağın etiketine kapağı ve adını işler. */
function paintCover(id: string) {
  const c = covers.get(id);
  if (!c) return;
  document.querySelectorAll<HTMLElement>(`.vinyl[data-pl="${id}"], .deck-disc[data-pl="${id}"]`).forEach((el) => {
    if (c.img) {
      el.style.setProperty('--cover', `url("${c.img}")`);
      el.classList.add('has-cover');
    }
    if (c.title && el.classList.contains('vinyl')) {
      el.setAttribute('aria-label', c.title);
      el.title = c.title;
    }
  });
  if (c.title && $('deck-disc').dataset.pl === id) $('deck-now').textContent = c.title;
}
/**
 * Kapak resmi ve liste adı Spotify'ın herkese açık oEmbed adresinden, sayfa açıkken alınır.
 * Ulaşılamazsa (ağ engeli, gizli liste) plak renkli etiketi ve numarasıyla kalır.
 */
function loadCovers() {
  playlists.forEach(({ id }) => {
    if (covers.has(id)) return paintCover(id);
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/playlist/${id}`)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { thumbnail_url?: string; title?: string }) => {
        covers.set(id, { img: d.thumbnail_url, title: d.title });
        try {
          sessionStorage.setItem('pl-covers', JSON.stringify(Object.fromEntries(covers)));
        } catch {
          /* gizli sekme */
        }
        paintCover(id);
      })
      .catch(() => {
        /* kapak yoksa numaralı etiket kalır */
      });
  });
}
function musicShelf() {
  const pick = lang === 'en' ? '♪ pick a record' : '♪ bir plak seç';
  return (
    `<div class="deck" id="deck"><div class="deck-platter" id="deck-platter"><div class="deck-disc" id="deck-disc"><u></u></div><i class="deck-pin"></i></div>` +
    `<div class="deck-arm" aria-hidden="true"><i></i></div><span class="deck-notes" aria-hidden="true"><i>♪</i><i>♫</i><i>♪</i></span>` +
    `<p class="deck-now" id="deck-now">${pick}</p></div>` +
    `<div class="shelf" id="shelf">${playlists
      .map(
        (pl, k) =>
          `<button type="button" class="vinyl" data-pl="${pl.id}" data-k="${k}" style="--c:${VINYL[k % VINYL.length]};--k:${k}" aria-label="${plName(pl.id, k).replace(/"/g, '&quot;')}"><u>${k + 1}</u><i></i></button>`,
      )
      .join('')}</div>` +
    `<div class="player" id="player"></div>`
  );
}

/* ---- kalıcı oynatıcı: Spotify çerçevesi çekmecenin dışında yaşar, başka gezegene geçince müzik kesilmez ---- */
type SpCtrl = {
  loadUri: (uri: string) => void;
  togglePlay: () => void;
  destroy: () => void;
  addListener: (ev: string, cb: (e: { data: { isPaused: boolean } }) => void) => void;
};
type SpApi = {
  createController: (
    el: HTMLElement,
    o: { uri: string; width: string; height: number },
    cb: (c: SpCtrl) => void,
  ) => void;
};
const np = { id: '', k: -1, color: '', playing: false, known: false, ctrl: null as SpCtrl | null };
const npFrame = document.createElement('div');
npFrame.className = 'np-frame';
const npBox = document.createElement('div');
npBox.className = 'np';
npBox.hidden = true;
npBox.innerHTML =
  `<button type="button" class="np-disc" id="np-disc"><span class="vinyl" id="np-vinyl"><u></u><i></i></span></button>` +
  `<span class="np-text"><small id="np-state"></small><b id="np-title"></b></span>` +
  `<button type="button" class="np-btn" id="np-toggle" hidden></button>` +
  `<button type="button" class="np-btn" id="np-stop">✕</button>` +
  `<p class="np-tip" id="np-tip" hidden></p>`;
document.body.append(npFrame, npBox);
$('np-disc').setAttribute('aria-label', lang === 'en' ? 'Open the Music planet' : 'Müzik gezegenini aç');
$('np-stop').setAttribute('aria-label', lang === 'en' ? 'Stop the music' : 'Müziği durdur');
let spApi: Promise<SpApi> | null = null;
/** Spotify'ın gömme denetimi: duraklat / devam et düğmesi bununla çalışır. Yüklenemezse düz oynatıcıya düşülür. */
const loadSpApi = () =>
  (spApi ??= new Promise<SpApi>((ok, fail) => {
    (window as unknown as { onSpotifyIframeApiReady: (a: SpApi) => void }).onSpotifyIframeApiReady = ok;
    const sc = document.createElement('script');
    sc.src = 'https://open.spotify.com/embed/iframe-api/v1';
    sc.async = true;
    sc.onerror = () => fail(new Error('spotify api'));
    document.head.append(sc);
    setTimeout(() => fail(new Error('spotify api timeout')), 7000);
  }));
const playerH = () => (innerWidth < 900 ? 152 : Math.round(Math.min(352, Math.max(152, innerHeight * 0.78 - 500))));
function npPaint() {
  const on = !!np.id;
  const inMusic = drawer.classList.contains('music') && drawer.classList.contains('open');
  npBox.hidden = !on || inMusic;
  if (!on) return;
  const v = $('np-vinyl');
  v.style.setProperty('--c', np.color);
  v.dataset.pl = np.id;
  v.querySelector('u')!.textContent = String(np.k + 1);
  v.style.removeProperty('--cover');
  v.classList.remove('has-cover');
  const c = covers.get(np.id);
  if (c?.img) {
    v.style.setProperty('--cover', `url("${c.img}")`);
    v.classList.add('has-cover');
  }
  $('np-title').textContent = plName(np.id, np.k);
  const playing = np.known ? np.playing : true;
  npBox.classList.toggle('spin', playing);
  $('np-state').textContent = np.known
    ? playing
      ? lang === 'en'
        ? 'now playing'
        : 'şimdi çalıyor'
      : lang === 'en'
        ? 'paused'
        : 'duraklatıldı'
    : lang === 'en'
      ? 'on the turntable'
      : 'pikapta';
  const tg = $('np-toggle');
  tg.hidden = !np.ctrl;
  tg.textContent = playing ? '❚❚' : '▶';
  tg.setAttribute('aria-label', playing ? (lang === 'en' ? 'Pause' : 'Duraklat') : lang === 'en' ? 'Play' : 'Devam et');
}
/** Oynatıcıyı kurar ya da aynı oynatıcıya yeni listeyi yükler. */
function mountPlayer(id: string, k: number, color: string) {
  np.id = id;
  np.k = k;
  np.color = color;
  np.playing = false;
  np.known = false;
  const uri = `spotify:playlist:${id}`;
  if (np.ctrl) {
    np.ctrl.loadUri(uri);
    npPaint();
    return;
  }
  const plain = () => {
    if (np.id !== id || np.ctrl) return;
    const theme = root.getAttribute('data-theme') === 'night' ? '&theme=0' : '';
    npFrame.innerHTML = `<iframe title="Spotify" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" src="https://open.spotify.com/embed/playlist/${id}?utm_source=generator${theme}"></iframe>`;
  };
  npFrame.innerHTML = '<div></div>';
  const host = npFrame.firstElementChild as HTMLElement;
  loadSpApi().then((api) => {
    if (np.id !== id || !host.isConnected) return;
    api.createController(host, { uri, width: '100%', height: playerH() }, (ctrl) => {
      if (!np.id) {
        ctrl.destroy();
        return;
      }
      np.ctrl = ctrl;
      if (np.id !== id) ctrl.loadUri(`spotify:playlist:${np.id}`);
      ctrl.addListener('playback_update', (e) => {
        np.known = true;
        np.playing = !e.data.isPaused;
        npPaint();
      });
      npPaint();
    });
  }, plain);
  npPaint();
}
/** Müziği tamamen kapatır: plak rafa döner, köşedeki küçük plak kaybolur. */
function stopMusic() {
  try {
    np.ctrl?.destroy();
  } catch {
    /* oynatıcı zaten gitmiş */
  }
  np.ctrl = null;
  np.id = '';
  npFrame.innerHTML = '';
  npPaint();
  const deck = document.getElementById('deck');
  if (deck) {
    playTimers.forEach(clearTimeout);
    playTimers = [];
    deck.classList.remove('has', 'on', 'down', 'busy');
    const disc = $('deck-disc');
    spinTo(disc, 0, 500);
    delete disc.dataset.pl;
    $('shelf')
      .querySelectorAll('.vinyl')
      .forEach((v) => v.classList.remove('out'));
    $('deck-now').textContent = lang === 'en' ? '♪ pick a record' : '♪ bir plak seç';
    $('player').innerHTML = '';
  }
}
/** Çekmecedeki oynatıcı yeri: çerçeve bunun tam üstüne oturur. */
function fillSlot() {
  const slot = document.getElementById('player');
  if (!slot || !np.id) return;
  const open = `<a class="pl-open" href="https://open.spotify.com/playlist/${np.id}" target="_blank" rel="noopener">${lang === 'en' ? 'Open in Spotify' : "Spotify'da aç"} ↗</a>`;
  const stop = `<button type="button" class="pl-stop" data-pl-stop>${lang === 'en' ? 'Stop the music' : 'Müziği durdur'} ✕</button>`;
  slot.innerHTML = embedBlocked
    ? `<p class="pl-note">${lang === 'en' ? 'The player cannot be shown in this preview. On the live site it plays right here.' : 'Oynatıcı bu önizlemede gösterilemiyor. Yayındaki sitede tam burada çalacak.'}</p><div class="pl-row">${stop}${open}</div>`
    : `<div class="pl-slot" id="pl-slot" style="height:${playerH()}px"></div><div class="pl-row">${stop}${open}</div>` +
      `<p class="pl-tip">${lang === 'en' ? 'You can keep exploring the galaxy while the music plays: a small record follows you in the corner, and you can stop it from there. Switching the language stops the music.' : 'Müzik çalarken galakside gezmeye devam edebilirsin: küçük bir plak köşede seni takip eder, oradan durdurabilirsin. Dil değişince müzik durur.'}</p>`;
}
/** Müzik gezegenine geri dönüldüğünde pikap boş görünmesin: çalan plak yerinde durur. */
function dressDeck() {
  const deck = document.getElementById('deck');
  if (!deck || !np.id) return;
  const disc = $('deck-disc');
  disc.dataset.pl = np.id;
  disc.style.setProperty('--c', np.color);
  disc.querySelector('u')!.textContent = String(np.k + 1);
  paintCover(np.id);
  $('deck-now').textContent = plName(np.id, np.k);
  $('shelf')
    .querySelectorAll<HTMLElement>('.vinyl')
    .forEach((v) => v.classList.toggle('out', v.dataset.pl === np.id));
  deck.classList.add('has', 'on', 'down');
  spinTo(disc, 1, 600);
  fillSlot();
}
// çerçeve, çekmecedeki yerinin üstünde durur; çekmece müzikte değilken görünmez ama çalmaya devam eder
{
  let shown = false;
  let tipDone = false;
  const tick = () => {
    const slot = document.getElementById('pl-slot');
    const inMusic = drawer.classList.contains('music') && drawer.classList.contains('open');
    const show = !!np.id && !!slot && inMusic && !embedBlocked;
    if (show) {
      const r = slot!.getBoundingClientRect();
      const c = $('drawer-body').getBoundingClientRect();
      const st = npFrame.style;
      st.left = `${r.left}px`;
      st.top = `${r.top}px`;
      st.width = `${r.width}px`;
      st.height = `${r.height}px`;
      const top = Math.max(0, c.top - r.top);
      const bot = Math.max(0, r.bottom - c.bottom);
      st.clipPath = top || bot ? `inset(${top}px 0 ${bot}px 0 round 14px)` : '';
    }
    if (show !== shown) {
      shown = show;
      npFrame.classList.toggle('show', show);
      npFrame.inert = !show;
    }
    const mini = !!np.id && !inMusic;
    if (npBox.hidden === mini) {
      npPaint();
      // ilk kez: müziğin sürdüğünü ve nereden durdurulacağını söyle
      if (mini && !tipDone) {
        tipDone = true;
        const tip = $('np-tip');
        tip.textContent =
          lang === 'en'
            ? 'The music keeps playing while you explore. Stop it here.'
            : 'Sen gezerken müzik çalmaya devam ediyor. Buradan durdurabilirsin.';
        tip.hidden = false;
        setTimeout(() => (tip.hidden = true), 7000);
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  npFrame.inert = true;
  $('np-disc').addEventListener('click', () => {
    const b = galaxy?.planets.find((x) => x.opts.char === 'music');
    if (b) galaxy?.inspect(b);
  });
  $('np-toggle').addEventListener('click', () => np.ctrl?.togglePlay());
  $('np-stop').addEventListener('click', stopMusic);
}
/** Sayfayı barındıran ortam başka siteleri gömmeye izin vermiyorsa (örneğin önizleme) oynatıcı yerine bağlantı gösterilir. */
let embedBlocked = false;
document.addEventListener('securitypolicyviolation', (e) => {
  if (!/frame-src|child-src|default-src/.test(e.violatedDirective) || !/spotify/.test(e.blockedURI)) return;
  embedBlocked = true;
  fillSlot();
});
/** Pikabın dönüşü: plak birden değil, hızlanarak döner ve yavaşlayarak durur. */
let spin: Animation | null = null;
let spinRaf = 0;
function spinTo(disc: HTMLElement, to: number, ms: number) {
  if (reduce) return;
  if (!spin || (spin.effect as KeyframeEffect).target !== disc) {
    spin = disc.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: 3300, iterations: Infinity });
    spin.playbackRate = 0;
  }
  const a = spin;
  const from = a.playbackRate;
  const t0 = performance.now();
  cancelAnimationFrame(spinRaf);
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / ms);
    a.playbackRate = from + (to - from) * (k * k * (3 - 2 * k));
    if (k < 1) spinRaf = requestAnimationFrame(step);
  };
  spinRaf = requestAnimationFrame(step);
}
let playTimers: number[] = [];
function playRecord(btn: HTMLElement) {
  const id = btn.dataset.pl!;
  const k = Number(btn.dataset.k);
  const deck = $('deck');
  const disc = $('deck-disc');
  const platter = $('deck-platter');
  const shelf = $('shelf');
  if (disc.dataset.pl === id || deck.classList.contains('busy')) return;
  const alive = () => document.getElementById('deck-disc') === disc;
  const later = (fn: () => void, ms: number) => playTimers.push(window.setTimeout(() => alive() && fn(), ms));
  playTimers.forEach(clearTimeout);
  playTimers = [];
  const prev = disc.dataset.pl ? shelf.querySelector<HTMLElement>(`.vinyl[data-pl="${disc.dataset.pl}"]`) : null;
  const dress = () => {
    disc.dataset.pl = id;
    disc.style.setProperty('--c', btn.style.getPropertyValue('--c'));
    disc.style.removeProperty('--cover');
    disc.classList.remove('has-cover');
    disc.querySelector('u')!.textContent = String(k + 1);
    paintCover(id);
    $('deck-now').textContent = plName(id, k);
    shelf.querySelectorAll('.vinyl').forEach((v) => v.classList.toggle('out', v === btn));
  };
  const showPlayer = () => {
    const pl = $('player');
    mountPlayer(id, k, btn.style.getPropertyValue('--c'));
    fillSlot();
    // telefonda oynatıcı görünür alana gelsin
    const body = $('drawer-body');
    const over = pl.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom;
    if (over > 0) body.scrollBy({ top: over + 4, behavior: reduce ? 'auto' : 'smooth' });
  };
  if (reduce) {
    dress();
    deck.classList.add('has', 'on', 'down');
    showPlayer();
    return;
  }
  deck.classList.add('busy');
  deck.classList.remove('on', 'down'); // iğne kalkar, kol yerine döner
  spinTo(disc, 0, 380);
  deck.scrollIntoView({ block: 'nearest' });
  /** Bir plağın kopyasını ekranda a noktasından b noktasına taşır. */
  const fly = (from: HTMLElement, a: DOMRect, b: DOMRect, delay: number, drop: boolean) => {
    const el = from.cloneNode(true) as HTMLElement;
    el.removeAttribute('id');
    el.className = `vinyl fly${from.classList.contains('has-cover') ? ' has-cover' : ''}`;
    Object.assign(el.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.appendChild(el);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const sc = b.width / a.width;
    const big = Math.max(1, sc);
    const sh = (y: number, o: number) => `drop-shadow(0 ${y}px ${y * 0.7}px rgba(20, 8, 30, ${o}))`;
    const frames: Keyframe[] = drop
      ? [
          { transform: 'translate(0,0) scale(1) rotate(0deg)', filter: sh(2, 0.3), easing: 'cubic-bezier(.3,.9,.4,1)' },
          // raftan çekilir
          {
            transform: 'translate(0,-16px) scale(1.18) rotate(-14deg)',
            filter: sh(12, 0.35),
            offset: 0.2,
            easing: 'cubic-bezier(.5,0,.3,1)',
          },
          // yay çizerek pikabın üstüne gelir ve milin üstünde bir an durur
          {
            transform: `translate(${dx}px, ${dy - 26}px) scale(${big * 1.1}) rotate(8deg)`,
            filter: sh(22, 0.4),
            offset: 0.74,
            easing: 'ease-in-out',
          },
          {
            transform: `translate(${dx}px, ${dy - 24}px) scale(${big * 1.1}) rotate(0deg)`,
            filter: sh(22, 0.4),
            offset: 0.84,
            easing: 'cubic-bezier(.6,0,.9,.4)',
          },
          // mile oturur
          { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(0deg)`, filter: sh(2, 0.3) },
        ]
      : [
          { transform: 'translate(0,0) scale(1) rotate(0deg)', filter: sh(2, 0.3), easing: 'cubic-bezier(.3,.9,.4,1)' },
          {
            transform: 'translate(0,-20px) scale(1.08) rotate(0deg)',
            filter: sh(18, 0.4),
            offset: 0.3,
            easing: 'cubic-bezier(.5,0,.3,1)',
          },
          { transform: `translate(${dx}px, ${dy}px) scale(${sc}) rotate(-20deg)`, filter: sh(2, 0.3) },
        ];
    const anim = el.animate(frames, { duration: drop ? 1050 : 620, delay, fill: 'both' });
    return new Promise<void>((res) => {
      const end = () => {
        el.remove();
        res();
      };
      anim.onfinish = end;
      anim.oncancel = end;
    });
  };
  const target = disc.getBoundingClientRect();
  // pikaptaki plak boşken küçük duruyor olabilir: hedef her zaman tablanın %92'si
  const pr = platter.getBoundingClientRect();
  const full = new DOMRect(pr.left + pr.width * 0.04, pr.top + pr.height * 0.04, pr.width * 0.92, pr.height * 0.92);
  let wait = 0;
  if (prev && deck.classList.contains('has')) {
    // eski plak rafındaki yerine döner
    wait = 380;
    later(() => {
      deck.classList.remove('has');
      void fly(disc, target, prev.getBoundingClientRect(), 0, false).then(() => prev.classList.remove('out'));
    }, 300);
  }
  const from = btn.getBoundingClientRect();
  btn.classList.add('out');
  void fly(btn, from, full, wait + 120, true).then(() => {
    if (!alive()) return;
    dress();
    deck.classList.add('has');
    deck.classList.remove('busy');
    // plak oturunca tabla hafifçe esner
    platter.animate([{ scale: '1' }, { scale: '0.955' }, { scale: '1.012' }, { scale: '1' }], {
      duration: 420,
      easing: 'ease-out',
    });
    spinTo(disc, 1, 1500);
    later(() => deck.classList.add('on'), 180); // kol plağın üstüne gelir
    later(() => deck.classList.add('down'), 900); // iğne iner
    later(showPlayer, 1100);
  });
}

function showInspect(b: PlanetBody | null, i: number, n: number) {
  inspBody = b;
  if (!b) {
    drawer.classList.remove('open');
    root.classList.remove('inspecting');
    lockScroll('inspect', false);
    return;
  }
  const list = b.opts.posts ?? [];
  const plist = posts.filter((p) => p.planet === b.opts.char);
  const sec = SECTION_OF[b.opts.key];
  drawer.classList.remove('open');
  drawer.style.setProperty('--tone', b.opts.color);
  $('drawer-body').innerHTML =
    `<p class="eyebrow">${L(KIND[b.opts.key] ?? 'Gezegen')}</p><h3>${b.opts.name}</h3>` +
    (list.length
      ? `<p class="lead">${lang === 'en' ? `${list.length} ${list.length === 1 ? 'star' : 'stars'}. Touch one to read it.` : `${list.length} yıldız. Okumak için birine dokun.`}</p>` +
        (list.length > 10
          ? `<input class="post-filter" type="search" placeholder="${lang === 'en' ? 'Search these posts' : 'Bu yazılarda ara'}" aria-label="${lang === 'en' ? 'Search these posts' : 'Bu yazılarda ara'}" />`
          : '') +
        plist
          .map(
            (p, k) =>
              `<button type="button" class="post" data-read="${k}" style="--k:${Math.min(k, 10)}"><small>${postMeta(p)}</small>${esc(p.title)}</button>`,
          )
          .join('')
      : sec
        ? `<p class="lead">${L('Bu gezegen sitenin bir bölümünü taşıyor.')}</p><button type="button" class="go" data-go="${sec}">${L('Bölüme git →')}</button>`
        : b.opts.key === 'topic'
          ? `<p class="lead">${L('Bu gezegenin yıldızları yolda. İlk yazı geldiğinde burada görünecek.')}</p>`
          : b.opts.char === 'music' && playlists.length
            ? musicShelf()
            : b.opts.char === 'art'
              ? `<p class="lead">${L('İş dışında beni oyalayan şeylerden biri.')}</p>` +
                `<div class="vangogh" aria-hidden="true"><i></i><i></i><i></i><b></b></div>` +
                `<p class="vg-cap">${lang === 'en' ? 'My favourite painter is Van Gogh. The swirls of The Starry Night suit this galaxy too.' : 'Favori ressamım Van Gogh. Yıldızlı Gece’nin girdapları bu galaksiye de yakışıyor.'}</p>`
              : `<p class="lead">${L('İş dışında beni oyalayan şeylerden biri.')}</p>`);
  if (b.opts.char === 'music' && playlists.length) {
    loadCovers();
    dressDeck();
  }
  drawer.classList.toggle('music', b.opts.char === 'music');
  drawer.classList.remove('scrolled');
  $('insp-count').textContent = `${i + 1} / ${n}`;
  $('drawer-body').scrollTop = 0;
  void drawer.offsetWidth;
  drawer.classList.add('open');
  root.classList.add('inspecting');
  lockScroll('inspect', true);
}
$('insp-prev').addEventListener('click', () => galaxy?.inspectStep(-1));
$('insp-next').addEventListener('click', () => galaxy?.inspectStep(1));
$('insp-poke').addEventListener('click', () => galaxy?.pokeInspected());
// kaydırılınca içerik üst kenarda yumuşakça kaybolur: kapat düğmesinin altından geçen yarım satır kalmaz
$('drawer-body').addEventListener('scroll', () => drawer.classList.toggle('scrolled', $('drawer-body').scrollTop > 6), {
  passive: true,
});
$('drawer-body').addEventListener('input', (e) => {
  const inp = e.target as HTMLInputElement;
  if (!inp.classList.contains('post-filter')) return;
  const q = inp.value.trim().toLocaleLowerCase('tr');
  $('drawer-body')
    .querySelectorAll<HTMLElement>('.post')
    .forEach((el) => (el.hidden = !!q && !(el.textContent ?? '').toLocaleLowerCase('tr').includes(q)));
});
$('drawer-body').addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('[data-pl-stop]')) {
    stopMusic();
    return;
  }
  const rec = t.closest<HTMLElement>('[data-pl]');
  if (rec) {
    playRecord(rec);
    return;
  }
  const read = t.closest<HTMLElement>('[data-read]');
  if (read && inspBody) {
    openReader(inspBody.opts.char ?? '', Number(read.dataset.read));
    return;
  }
  const go = t.closest<HTMLElement>('[data-go]');
  if (!go) return;
  setExplore(false);
  galaxy?.inspect(null);
  goTo(Number(go.dataset.go));
});

// kapalı çekmecenin düğmeleri klavyeyle ve ekran okuyucuyla ulaşılamaz olsun
const syncDrawer = () => (drawer.inert = !drawer.classList.contains('open') || root.classList.contains('reading'));
new MutationObserver(syncDrawer).observe(drawer, { attributes: true, attributeFilter: ['class'] });
syncDrawer();

function closeDrawer() {
  if (galaxy?.inspecting) {
    galaxy.inspect(null);
    return;
  }
  drawer.classList.remove('open');
  galaxy?.unpin();
}
$('drawer-close').addEventListener('click', closeDrawer);

/* ---------- gece / gündüz: düğmedeki küçük sahne (uzaylı ayı ya da güneşi iterek getirir) ---------- */
const themeBtn = $('theme');
const themeArt = themeScene($('theme-scene'));
themeArt.pose(root.getAttribute('data-theme') === 'night' ? 'night' : 'day');
let themeBusy = false;
const toggleTheme = () => {
  // animasyon bitmeden ikinci tıklama yok: sahne asla yarım kalmaz
  if (themeBusy || galaxy?.morphing) return;
  const next: Theme = root.getAttribute('data-theme') === 'night' ? 'day' : 'night';
  if (galaxy) galaxy.switchTheme(next);
  else applyTheme(next);
  if (reduce) return themeArt.pose(next);
  themeBusy = true;
  const run = themeArt.play(next);
  setTimeout(() => {
    // son kare ile durağan hal birebir aynı: önce hali yaz, sonra animasyonları bırak
    themeArt.pose(next);
    run.A.forEach((a) => a.cancel());
    themeBusy = false;
  }, run.total + 40);
};
themeBtn.addEventListener('click', toggleTheme);

/* ---------- doğum günü (25 Kasım): açılışta konfeti ---------- */
setTimeout(
  () => {
    const today = new Date();
    const mmdd = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (birthday && birthday === mmdd && !reduce) {
      confetti($('labels'), innerWidth / 2, innerHeight * 0.4, 120);
      document.querySelector('.nick')?.append(' 🎂');
    }
  },
  booting ? 11000 : 2300,
);

/* ---------- başlık: harfler fareye yaylanarak tepki verir ---------- */
// Sadece transform kullanılır (genişlik değişmez), böylece harfler birbirini itmez.
const chars: { el: HTMLElement; y: number; r: number; s: number; f: number }[] = [];
document.querySelectorAll<HTMLElement>('#kinetic .word').forEach((w) => {
  (w.dataset.part ?? '').split('').forEach((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.style.setProperty('--n', String(chars.length));
    s.textContent = c === ' ' ? ' ' : c;
    s.setAttribute('aria-hidden', 'true');
    w.appendChild(s);
    chars.push({ el: s, y: 0, r: 0, s: 1, f: 0 });
  });
});
if (!reduce) {
  let mx = -9999,
    my = -9999,
    running = false;
  const centers = () => chars.map((c) => c.el.getBoundingClientRect());
  let rects = centers();
  addEventListener('resize', () => (rects = centers()));
  addEventListener('scroll', () => (rects = centers()), { passive: true });
  const step = () => {
    let moving = false;
    chars.forEach((c, i) => {
      const r = rects[i];
      const dx = mx - (r.left + r.width / 2),
        dy = my - (r.top + r.height / 2);
      const f = Math.max(0, 1 - Math.hypot(dx, dy * 1.4) / 200);
      const ty = -f * 18,
        tr = Math.max(-1, Math.min(1, dx / 120)) * -f * 10,
        ts = 1 + f * 0.1;
      c.y += (ty - c.y) * 0.14;
      c.r += (tr - c.r) * 0.14;
      c.s += (ts - c.s) * 0.14;
      c.f += (f - c.f) * 0.14;
      if (Math.abs(ty - c.y) > 0.05 || Math.abs(tr - c.r) > 0.05) moving = true;
      c.el.style.transform = `translateY(${c.y.toFixed(2)}px) rotate(${c.r.toFixed(2)}deg) scale(${c.s.toFixed(3)})`;
      c.el.style.setProperty('--f', c.f.toFixed(3));
    });
    running = moving;
    if (moving) requestAnimationFrame(step);
  };
  addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    if (!running && scrollY < innerHeight) {
      running = true;
      rects = centers();
      requestAnimationFrame(step);
    }
  });
}

/* ---------- bölüme git: kamera doğrudan uçar, yazılar uçuş sırasında saklanır ---------- */
const goTo = (i: number) => {
  const y = i * innerHeight;
  if (!galaxy || reduce) {
    if (lenis) lenis.scrollTo(y, { duration: 1.4 });
    else window.scrollTo({ top: y });
    return;
  }
  if (i === section && Math.abs(scrollY - y) < 4) return;
  flying = true;
  root.classList.add('flying');
  lenis?.stop();
  galaxy.flyTo(i, () => {
    flying = false;
    root.classList.remove('flying');
  });
  setTimeout(() => {
    if (lenis) {
      lenis.start();
      lenis.scrollTo(y, { immediate: true, force: true });
    } else window.scrollTo({ top: y });
  }, 350); // önce yazılar solar, sonra kaydırma anında yapılır
};

/* ---------- gözlemevi ----------
   Tıklayınca kilden bir teleskop ortaya gelir, ayağının üzerinde döner ve biz göz merceğine yaklaşırız.
   Mercekte bir gezegen görünür; çevresindeki halkayı çevirerek bütün gezegenler tek tek gezilir. */
const scope = $('scope');
const telescope = $('telescope');
const ring = $('scope-ring');
const scopeName = $('scope-name');
const scopeKind = $('scope-kind');
const scopeGo = $('scope-go');
const focusEl = scope.querySelector<HTMLElement>('.focus')!;
const timers: number[] = [];
const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, reduce ? 0 : ms));
const clearTimers = () => timers.splice(0).forEach(clearTimeout);
const bodies = galaxy?.planets ?? [];
const N = Math.max(1, bodies.length);
const STEP = 360 / N;
/** Merceğin ekrandaki yeri ve yarıçapı: altında gezegenin adı ve düğmeler için yer kalır. */
const lensGeom = () => {
  const w = innerWidth,
    h = innerHeight;
  if (h <= 520) {
    const r = Math.max(70, Math.min(h * 0.5 - 70, 150));
    return { x: Math.max(r + 66, w * 0.3), y: h / 2 + 6, r };
  }
  const r = Math.max(90, Math.min(w / 2 - 58, (h - 330) / 2, 230));
  return { x: w / 2, y: Math.max(r + 120, h * 0.44), r };
};
/** Merceğin merkezini ve yarıçapını (istenirse yumuşakça) değiştirir. */
const irisTo = (x: number, y: number, r: number, ms = 0, ease = 'cubic-bezier(.65,0,.25,1)') => {
  scope.style.transition =
    ms && !reduce
      ? `--cx ${ms}ms ${ease}, --cy ${ms}ms ${ease}, --iris ${ms}ms ${ease}, opacity 350ms ease`
      : 'opacity 350ms ease';
  scope.style.setProperty('--cx', `${x}px`);
  scope.style.setProperty('--cy', `${y}px`);
  scope.style.setProperty('--iris', `${r}px`);
};
let scopeOpen = false;
let scopeIdx = 0;
let rot = 0;
let scopeIntro: ScopeIntro | null = null;
const beads = bodies.map((b, i) => {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'scope-bead';
  el.tabIndex = -1;
  el.dataset.bead = String(i);
  el.style.setProperty('--a', `${i * STEP}deg`);
  el.style.setProperty('--c', b.opts.color);
  ring.append(el);
  return el;
});
const setRot = (deg: number, snap: boolean) => {
  rot = deg;
  ring.classList.toggle('snap', snap);
  scope.style.setProperty('--rot', `${deg}deg`);
};
const setScopeIdx = (i: number) => {
  i = ((i % N) + N) % N;
  const changed = i !== scopeIdx;
  scopeIdx = i;
  const b = bodies[i];
  if (!b) return;
  galaxy?.setScopeTarget(i);
  scopeName.textContent = b.opts.name;
  scopeKind.textContent = `${L(KIND[b.opts.key] ?? 'Gezegen')} · ${i + 1} / ${N}`;
  scopeGo.textContent = L(SECTION_OF[b.opts.key] ? 'Bölüme git' : 'Yakından incele');
  scope.style.setProperty('--accent-planet', b.opts.color);
  beads.forEach((el, k) => el.classList.toggle('on', k === i));
  if (changed && !reduce) {
    scopeName.classList.remove('swap');
    void scopeName.offsetWidth;
    scopeName.classList.add('swap');
    focusEl.animate([{ backdropFilter: 'blur(7px)' }, { backdropFilter: 'blur(0px)' }], {
      duration: 600,
      easing: 'ease-out',
    });
  }
};
/** Halkayı en kısa yoldan i. gezegene çevirir. */
const scopeTo = (i: number) => {
  i = ((i % N) + N) % N;
  let t = -i * STEP;
  t += 360 * Math.round((rot - t) / 360);
  setRot(t, true);
  setScopeIdx(i);
};
const startPlanet = () => {
  const key =
    section === 1 ? 'about' : section === 2 ? 'growth' : section === 4 ? 'contact' : section === 3 ? 'topic' : '';
  const i = bodies.findIndex((b) => b.opts.key === key);
  return i < 0 ? 0 : i;
};
const openScope = async () => {
  if (scopeOpen || !galaxy || exploring || root.classList.contains('reading')) return;
  if (galaxy.inspecting) galaxy.inspect(null);
  scopeOpen = true;
  clearTimers();
  lockScroll('scope', true);
  telescope.setAttribute('aria-expanded', 'true');
  const start = startPlanet();
  const g = lensGeom();
  const tr = telescope.getBoundingClientRect();
  scope.hidden = false;
  scope.classList.remove('ready', 'lensed');
  irisTo(g.x, g.y, 0);
  setRot(-start * STEP, false);
  scopeIdx = -1;
  setScopeIdx(start);
  void scope.offsetWidth;
  scope.style.opacity = '1';
  root.classList.add('scoping');
  const finish = () => {
    if (!scopeOpen) return;
    galaxy!.openScope(scopeIdx, g);
    irisTo(g.x, g.y, g.r);
    scope.classList.add('lensed');
    later(120, () => {
      scope.classList.add('ready');
      scopeGo.focus({ preventScroll: true });
    });
  };
  if (reduce) {
    finish();
    return;
  }
  // perde kapanınca (kimse görmeden) kamera mercekteki gezegene döner
  later(380, () => scopeOpen && galaxy!.openScope(scopeIdx, g));
  try {
    scopeIntro ??= new ScopeIntro($('scope3d') as unknown as HTMLCanvasElement);
    await scopeIntro.play({
      from: { x: tr.left + tr.width / 2, y: tr.top + tr.height * 0.42 },
      lens: g,
      night: root.getAttribute('data-theme') === 'night',
      onLook: () => {},
      onIris: (x, y, r) => scopeOpen && irisTo(x, y, r),
    });
  } catch (e) {
    console.error(e); // WebGL ikinci tuvali vermezse açılış doğrudan olur
  }
  finish();
};
/** Kapanış: mercek kapanır, kamera yerine döner, perde kalkar. `then` perde kalkmadan hemen önce çalışır. */
const closeScope = (then?: () => void) => {
  if (!scopeOpen) return;
  scopeOpen = false;
  clearTimers();
  scopeIntro?.stop();
  scope.classList.remove('ready');
  telescope.setAttribute('aria-expanded', 'false');
  const g = lensGeom();
  irisTo(g.x, g.y, 0, 380, 'cubic-bezier(.5,0,.3,1)');
  later(390, () => {
    scope.classList.remove('lensed');
    galaxy?.closeScope();
    root.classList.remove('scoping');
    then?.();
  });
  later(760, () => (scope.style.opacity = '0'));
  later(1130, () => {
    scope.hidden = true;
    lockScroll('scope', false);
  });
};
telescope.addEventListener('click', () => (scopeOpen ? closeScope() : openScope()));
$('scope-x').addEventListener('click', () => closeScope());
$('scope-prev').addEventListener('click', () => scopeTo(scopeIdx - 1));
$('scope-next').addEventListener('click', () => scopeTo(scopeIdx + 1));
scopeGo.addEventListener('click', () => {
  const b = bodies[scopeIdx];
  if (!b) return;
  const sec = SECTION_OF[b.opts.key];
  closeScope(() => (sec ? goTo(sec) : galaxy?.inspect(b)));
});
// halkayı (ya da merceği) parmakla / fareyle çevirme
{
  let d: { a0: number; rot0: number; moved: number } | null = null;
  const ang = (e: PointerEvent) => {
    const g = lensGeom();
    return (Math.atan2(e.clientY - g.y, e.clientX - g.x) * 180) / Math.PI;
  };
  ring.addEventListener('pointerdown', (e) => {
    if (!scope.classList.contains('ready')) return;
    d = { a0: ang(e), rot0: rot, moved: 0 };
    ring.setPointerCapture(e.pointerId);
  });
  ring.addEventListener('pointermove', (e) => {
    if (!d) return;
    let delta = ang(e) - d.a0;
    delta -= 360 * Math.round(delta / 360);
    // açı sürekli kalsın: bir önceki değere en yakın tur
    const target = d.rot0 + delta;
    const cont = target + 360 * Math.round((rot - target) / 360);
    d.moved = Math.max(d.moved, Math.abs(cont - d.rot0));
    if (d.moved < 2.5) return;
    setRot(cont, false);
    setScopeIdx(Math.round(-cont / STEP));
  });
  const up = (e: PointerEvent) => {
    if (!d) return;
    const moved = d.moved;
    d = null;
    if (moved < 2.5) {
      const bead = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(
        '[data-bead]',
      );
      if (bead) scopeTo(Number(bead.dataset.bead));
      return;
    }
    scopeTo(Math.round(-rot / STEP));
  };
  ring.addEventListener('pointerup', up);
  ring.addEventListener('pointercancel', up);
  let wheelAt = 0;
  scope.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (!scope.classList.contains('ready') || performance.now() - wheelAt < 220 || Math.abs(e.deltaY) < 4) return;
      wheelAt = performance.now();
      scopeTo(scopeIdx + (e.deltaY > 0 ? 1 : -1));
    },
    { passive: false },
  );
}

/* ---------- serbest gezinti: galakside sürükleyerek dolaşma ---------- */
const hud = $('hud');
let exploring = false;
function setExplore(on: boolean) {
  if (on === exploring || !galaxy) return;
  if (on && (scopeOpen || flying)) return;
  exploring = on;
  galaxy.setExplore(on);
  lockScroll('explore', on);
  if (on) {
    hud.hidden = false;
    void hud.offsetWidth;
  } else setTimeout(() => !exploring && (hud.hidden = true), 420);
  root.classList.toggle('exploring', on);
}
{
  const chips = $('hud-chips');
  bodies.forEach((b) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.style.setProperty('--c', b.opts.color);
    const n = b.opts.posts?.length ?? 0;
    el.innerHTML = `<i></i>${b.opts.name}${n ? `<small>${n} ✦</small>` : ''}`;
    el.addEventListener('click', () => galaxy?.inspect(b));
    chips.append(el);
  });
  document.querySelectorAll<HTMLElement>('[data-explore]').forEach((el) =>
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      setExplore(true);
    }),
  );
  $('hud-x').addEventListener('click', () => setExplore(false));
  $('hud-in').addEventListener('click', () => galaxy?.exploreZoom(0.72));
  $('hud-out').addEventListener('click', () => galaxy?.exploreZoom(1.38));
  $('hud-home').addEventListener('click', () => {
    galaxy?.setExplore(false);
    galaxy?.setExplore(true);
  });
}

/* ---------- kart içeriği sığmıyorsa altta bir ok belirir (içeride kaydırılabildiğini gösterir) ---------- */
document.querySelectorAll<HTMLElement>('.panel').forEach((panel) => {
  const inner = panel.querySelector<HTMLElement>('.panel-in');
  if (!inner) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'panel-more';
  btn.textContent = '↓';
  btn.setAttribute('aria-label', L('Devamını göster'));
  panel.append(btn);
  const sync = () => panel.classList.toggle('more', inner.scrollHeight - inner.scrollTop - inner.clientHeight > 40);
  btn.addEventListener('click', () =>
    inner.scrollBy({ top: inner.clientHeight * 0.7, behavior: reduce ? 'auto' : 'smooth' }),
  );
  inner.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  new ResizeObserver(sync).observe(inner);
  sync();
});
/* ---------- serbest gezinti: gezegen şeridi sağa doğru devam ediyorsa ok ve solma ---------- */
{
  const chips = $('hud-chips');
  const wrap = chips.parentElement!;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'hud-next';
  next.textContent = '›';
  next.setAttribute('aria-label', L('Diğer gezegenler'));
  wrap.append(next);
  const sync = () => wrap.classList.toggle('more', chips.scrollWidth - chips.scrollLeft - chips.clientWidth > 12);
  next.addEventListener('click', () =>
    chips.scrollBy({ left: chips.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' }),
  );
  chips.addEventListener('scroll', sync, { passive: true });
  addEventListener('resize', sync);
  new ResizeObserver(sync).observe(chips);
}

/* ---------- okuma sayfası: bir yıldıza dokununca yazısı açılır ---------- */
const reader = $('reader');
const readerScroll = $('reader-scroll');
let lastTap = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener('pointerdown', (e) => (lastTap = { x: e.clientX, y: e.clientY }), true);
let reading = -1;
/** Yazının o an okunan dili: site diliyle başlar, yazının içindeki TR · EN ile değişir. */
let readLang: 'tr' | 'en' = lang;
reader
  .querySelectorAll<HTMLElement>('.rd-article > *')
  .forEach((el, k) => el.style.setProperty('--k', String(Math.min(k, 14))));
/** Yazı açıkken arkada kalan her şey tıklamaya, klavyeye ve ekran okuyucuya kapanır. */
function setBehind(off: boolean) {
  Array.from(document.body.children).forEach((el) => {
    if (el === reader || el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    (el as HTMLElement).inert = off;
  });
  if (!off) syncDrawer();
}
type PostBody = { html: string; toc: [string, string][] };
const bodyCache = new Map<string, Promise<PostBody>>();
/** Yazının gövdesini getirir: /posts/<klasör>.<dil>.json (önizlemede sayfaya gömülü gelir). */
function loadBody(id: string, l: string): Promise<PostBody> {
  const key = `${id}.${l}`;
  let p = bodyCache.get(key);
  if (!p) {
    const embedded = (window as unknown as { __POSTS?: Record<string, PostBody> }).__POSTS?.[key];
    p = embedded
      ? Promise.resolve(embedded)
      : fetch(`${import.meta.env.BASE_URL}posts/${key}.json`).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json() as Promise<PostBody>;
        });
    p.catch(() => bodyCache.delete(key));
    bodyCache.set(key, p);
  }
  return p;
}
const rdHeads = () => [...reader.querySelectorAll<HTMLElement>('.rd-body h2')];
const rdSpy = () => {
  const max = readerScroll.scrollHeight - readerScroll.clientHeight;
  $('rd-prog').style.setProperty('--p', String(max > 0 ? Math.min(1, readerScroll.scrollTop / max) : 0));
  let cur = '';
  rdHeads().forEach((h) => {
    if (h.getBoundingClientRect().top < 160) cur = h.id;
  });
  reader
    .querySelectorAll<HTMLElement>('[data-rd-jump]')
    .forEach((a) => a.classList.toggle('on', a.dataset.rdJump === cur));
};
/** Açık olan yazıyı seçili okuma diliyle doldurur. */
function fillReader() {
  const post = posts[reading];
  if (!post) return;
  const l = readLang;
  const list = posts.filter((p) => p.planet === post.planet);
  const j = list.indexOf(post);
  const no = list.length - j; // en eski yazı 1. yıldız
  const topic = topics.find((t) => t.id === post.planet);
  $('rd-planet').textContent = topic?.name ?? '';
  $('rd-kicker-planet').textContent = topic?.name ?? '';
  $('rd-no').textContent = lang === 'en' ? `star ${no}` : `${no}. yıldız`;
  $('rd-title').textContent = post.titles[l] ?? post.title;
  $('rd-date').textContent = fmtDate(post.date, l, true);
  $('rd-min').textContent = fmtMin(post.mins[l] ?? post.min, l);
  reader
    .querySelectorAll<HTMLElement>('[data-rd-lang]')
    .forEach((b) => b.classList.toggle('on', b.dataset.rdLang === l));
  $('rd-tags').innerHTML = post.tags.map((t) => `<span>#${esc(t)}</span>`).join('');
  ($('rd-src') as HTMLAnchorElement).href = post.url;
  const body = $('rd-body');
  const toc = $('rd-toc');
  body.classList.add('loading');
  const at = reading;
  loadBody(post.id, l).then(
    (b) => {
      if (reading !== at || readLang !== l) return;
      body.lang = l;
      body.innerHTML = b.html;
      body.querySelectorAll<HTMLElement>('[data-rd-copy]').forEach((el) => (el.textContent = L('kopyala')));
      toc.innerHTML = b.toc.map(([id, t]) => `<li><a href="#${id}" data-rd-jump="${id}">${esc(t)}</a></li>`).join('');
      body.classList.remove('loading');
      rdSpy();
    },
    () => {
      if (reading !== at || readLang !== l) return;
      toc.innerHTML = '';
      body.innerHTML = `<p class="rd-lead">${esc(post.summary)}</p><p>${
        lang === 'en'
          ? 'The post could not be loaded right now. You can read it on GitHub:'
          : 'Yazı şu an yüklenemedi. GitHub üzerinden okuyabilirsin:'
      } <a href="${post.url}" target="_blank" rel="noopener">learning-sky</a></p>`;
      body.classList.remove('loading');
    },
  );
}
function openReader(planetId: string, j: number) {
  const list = posts.filter((p) => p.planet === planetId);
  const post = list[j];
  if (!post || post.demo) return;
  const fresh = reading < 0;
  reading = posts.indexOf(post);
  if (fresh) readLang = lang;
  const topic = topics.find((t) => t.id === planetId);
  reader.style.setProperty('--tone', topic?.color ?? '#F7C548');
  // gezegenin içinde bir önceki (daha eski) ve bir sonraki (daha yeni) yıldız
  const nav = (id: string, p: (typeof posts)[number] | undefined) => {
    const el = $(id) as HTMLButtonElement;
    el.disabled = !p || !!p.demo;
    el.querySelector('b')!.textContent = p && !p.demo ? p.title : '-';
  };
  nav('rd-prev', posts[reading + 1]);
  nav('rd-nextb', posts[reading - 1]);
  $('rd-body').innerHTML = '';
  fillReader();
  readerScroll.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  if (!fresh) return;
  reader.style.setProperty('--rx', `${lastTap.x}px`);
  reader.style.setProperty('--ry', `${lastTap.y}px`);
  reader.hidden = false;
  void reader.offsetWidth;
  reader.classList.add('open');
  root.classList.add('reading');
  setBehind(true);
  lockScroll('reader', true);
  $('rd-back').focus({ preventScroll: true });
}
function closeReader() {
  if (reading < 0) return;
  reading = -1;
  reader.classList.remove('open');
  root.classList.remove('reading');
  setBehind(false);
  lockScroll('reader', false);
  setTimeout(() => reading < 0 && (reader.hidden = true), reduce ? 0 : 760);
}
$('rd-back').addEventListener('click', closeReader);
const readAt = (i: number) => {
  const p = posts[i];
  if (p) openReader(p.planet, posts.filter((x) => x.planet === p.planet).indexOf(p));
};
// yazılar en yeniden eskiye sıralı: "önceki" daha eski olan
$('rd-prev').addEventListener('click', () => readAt(reading + 1));
$('rd-nextb').addEventListener('click', () => readAt(reading - 1));
readerScroll.addEventListener('scroll', rdSpy, { passive: true });
reader.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const jump = t.closest<HTMLElement>('[data-rd-jump]');
  if (jump) {
    e.preventDefault();
    document
      .getElementById(jump.dataset.rdJump!)
      ?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    return;
  }
  const lg = t.closest<HTMLElement>('[data-rd-lang]');
  if (lg && lg.dataset.rdLang !== readLang) {
    readLang = lg.dataset.rdLang as 'tr' | 'en';
    fillReader();
    return;
  }
  const copy = t.closest<HTMLElement>('[data-rd-copy]');
  if (copy) {
    const text = copy.closest('.rd-code')?.querySelector('pre')?.textContent ?? '';
    const done = () => {
      copy.textContent = L('kopyalandı ✓');
      setTimeout(() => (copy.textContent = L('kopyala')), 1600);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
    else done();
  }
});

/* ---------- sayfanın kaydırma çubuğu: bölümler arasında gezen küçük gezegen ---------- */
{
  const bar = $('pagebar');
  const thumb = $('pb-thumb');
  const last = secEls.length - 1;
  const update = () => {
    const p = Math.min(1, Math.max(0, scrollY / (last * innerHeight)));
    thumb.style.setProperty('--p', p.toFixed(4));
    thumb.style.setProperty('--pb', secEls[Math.round(p * last)].style.getPropertyValue('--tone'));
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
  let drag: { moved: number; y: number } | null = null;
  const at = (e: PointerEvent) => {
    const r = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  };
  const scrollToP = (p: number) => {
    const y = p * last * innerHeight;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y });
  };
  bar.addEventListener('pointerdown', (e) => {
    drag = { moved: 0, y: e.clientY };
    bar.setPointerCapture(e.pointerId);
    bar.classList.add('drag');
  });
  bar.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.moved += Math.abs(e.clientY - drag.y);
    drag.y = e.clientY;
    if (drag.moved > 4) scrollToP(at(e));
  });
  const up = (e: PointerEvent) => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    bar.classList.remove('drag');
    // sürüklemeden tıklandıysa o bölüme uç; sürüklendiyse en yakın bölüme otursun
    const to = Math.round(at(e) * last);
    if (moved <= 4) goTo(to);
    else if (lenis) lenis.scrollTo(to * innerHeight, { duration: 0.6, force: true });
  };
  bar.addEventListener('pointerup', up);
  bar.addEventListener('pointercancel', up);
}

/* ---------- dil: Türkçe / İngilizce ---------- */
{
  const btn = $('lang');
  btn.dataset.lang = lang;
  // gezegen = şimdiki dil, etrafında dönen ay = diğer dil; tıklayınca yer değiştirirler
  $('lg-cur').textContent = lang.toUpperCase();
  $('lg-other').textContent = lang === 'tr' ? 'EN' : 'TR';
  btn.title = lang === 'tr' ? 'Switch to English' : 'Türkçeye geç';
  let swapping = false;
  btn.addEventListener('click', () => {
    if (swapping) return;
    swapping = true;
    btn.classList.add('swap');
    try {
      sessionStorage.setItem(
        'zero-swap',
        JSON.stringify({ y: scrollY, planet: inspBody ? bodies.indexOf(inspBody) : -1, explore: exploring }),
      );
    } catch {
      /* gizli sekme */
    }
    setTimeout(() => setLang(lang === 'tr' ? 'en' : 'tr'), reduce ? 0 : 620);
  });
}
void translate;

/* ---------- açılışı yeniden izle ---------- */
document.querySelectorAll<HTMLElement>('[data-replay]').forEach((el) =>
  el.addEventListener('click', () => {
    try {
      sessionStorage.setItem('zero-intro-play', el.dataset.replay!);
      history.scrollRestoration = 'manual';
    } catch {
      /* gizli sekme */
    }
    window.scrollTo(0, 0);
    location.reload();
  }),
);

addEventListener('keydown', (e) => {
  // M: müziği duraklat / devam ettir (yazı alanında yazarken değil)
  if ((e.key === 'm' || e.key === 'M') && np.ctrl && !(e.target as HTMLElement).closest?.('input, textarea')) {
    np.ctrl.togglePlay();
    return;
  }
  if (e.key === 'Escape') {
    if (reading >= 0) closeReader();
    else if (scopeOpen) closeScope();
    else if (galaxy?.inspecting) closeDrawer();
    else if (exploring) setExplore(false);
    else closeDrawer();
    return;
  }
  if (reading >= 0) return;
  const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (scopeOpen && dir) {
    e.preventDefault();
    scopeTo(scopeIdx + dir);
  } else if (galaxy?.inspecting && dir) {
    e.preventDefault();
    galaxy.inspectStep(dir);
  } else if (exploring) {
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [70, 0],
      ArrowRight: [-70, 0],
      ArrowUp: [0, 70],
      ArrowDown: [0, -70],
    };
    if (pan[e.key]) {
      e.preventDefault();
      galaxy?.explorePan(...pan[e.key]);
    } else if (e.key === '+' || e.key === '=') galaxy?.exploreZoom(0.8);
    else if (e.key === '-') galaxy?.exploreZoom(1.25);
  }
});

document.querySelectorAll<HTMLElement>('[data-goto]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const i = Number(el.dataset.goto);
    setExplore(false);
    galaxy?.inspect(null);
    if (scopeOpen) closeScope(() => goTo(i));
    else goTo(i);
  });
});

addEventListener('resize', () => {
  if (!scopeOpen || !scope.classList.contains('lensed')) return;
  const g = lensGeom();
  irisTo(g.x, g.y, g.r);
  galaxy?.setScopeLens(g);
});

/* ---------- dil değişiminden dönüş: kaldığın yere geri koy ---------- */
if (swap) {
  if (Math.abs(scrollY - swap.y) > 4) window.scrollTo(0, swap.y);
  setTimeout(() => {
    if (swap.explore) setExplore(true);
    const b = bodies[swap.planet];
    if (b) galaxy?.inspect(b);
  }, 350);
}
