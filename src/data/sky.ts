/**
 * Yazıların kaynağı: learning-sky deposu. Bu dosya yalnızca derleme sırasında (Node) çalışır.
 *
 * Nereden okur?
 *  1. SKY_DIR ortam değişkeni ya da bu deponun yanındaki ../learning-sky klasörü varsa oradan
 *     (bilgisayarda `npm run dev` derken henüz göndermediğin yazıları da görürsün).
 *  2. Yoksa GitHub'dan: sky.json + her yazının README.tr.md / README.en.md dosyası
 *     (GitHub Actions'taki yayın derlemesi bu yolu kullanır).
 *
 * Yalnızca status: "published" olan ve tarihi gelmiş yazılar alınır (build_sky.py ile aynı kural).
 */
import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import { bundledLanguages, createHighlighter, type Highlighter } from 'shiki';

const OWNER = 'zehrabetulcuhadar';
const REPO = 'learning-sky';
const RAW = process.env.SKY_BASE ?? `https://raw.githubusercontent.com/${OWNER}/${REPO}/main/`;
const BLOB = `https://github.com/${OWNER}/${REPO}/blob/main/`;
const TREE = `https://github.com/${OWNER}/${REPO}/tree/main/`;

export type Lang = 'tr' | 'en';
type Two = Record<Lang, string>;

interface Meta {
  id: string;
  date: string;
  topic: string;
  title: Two;
  slug: Two;
  summary: Two;
  tags: string[];
}

export interface SkyPost extends Meta {
  /** Okuma süresi (dakika) */
  min: Record<Lang, number>;
  body: Record<Lang, { html: string; toc: [string, string][] }>;
  url: string;
}

/** Bir yazının klasöründen dosya okur (yerel klasör ya da GitHub). */
type ReadFile = (rel: string) => Promise<string | null>;

const today = () => new Date().toISOString().slice(0, 10);

function localDir(): string | null {
  // SKY_BASE verilmişse (ör. test) her zaman o adresten okunur
  if (process.env.SKY_BASE) return null;
  const cands = [process.env.SKY_DIR, path.resolve('..', 'learning-sky')].filter(Boolean) as string[];
  for (const c of cands) if (fs.existsSync(path.join(c, 'posts'))) return c;
  return null;
}

async function fromDir(dir: string): Promise<{ metas: Meta[]; read: (id: string) => ReadFile }> {
  const metas: Meta[] = [];
  for (const id of fs.readdirSync(path.join(dir, 'posts')).sort()) {
    const f = path.join(dir, 'posts', id, 'meta.json');
    if (!fs.existsSync(f)) continue;
    const m = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (m.status !== 'published' || !m.date || m.date > today()) continue;
    metas.push({
      id,
      date: m.date,
      topic: m.topic,
      title: m.title,
      slug: m.slug,
      summary: m.summary,
      tags: m.tags ?? [],
    });
  }
  const read = (id: string): ReadFile => {
    return async (rel) => {
      const f = path.join(dir, 'posts', id, rel);
      return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
    };
  };
  return { metas, read };
}

async function get(url: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (r.ok) return await r.text();
    } catch {
      /* tekrar dene */
    }
    await new Promise((ok) => setTimeout(ok, 600 * (i + 1)));
  }
  throw new Error(`learning-sky okunamadı: ${url}`);
}

async function fromRemote(): Promise<{ metas: Meta[]; read: (id: string) => ReadFile }> {
  const raw = await get(RAW + 'sky.json');
  if (!raw) throw new Error('learning-sky deposunda sky.json bulunamadı');
  const sky = JSON.parse(raw) as { posts?: Meta[] };
  const metas = (sky.posts ?? []).map((p) => ({ ...p, tags: p.tags ?? [] }));
  return { metas, read: (id) => (rel) => get(`${RAW}posts/${id}/${rel}`) };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isRel = (u: string) => !/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(u);

let hl: Promise<Highlighter> | null = null;
const highlighter = () => (hl ??= createHighlighter({ themes: ['github-light', 'github-dark'], langs: [] }));

async function render(md: string, id: string, read: ReadFile) {
  // README'nin başındaki dil satırı ve ana başlık sitede ayrıca gösterilir
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let h1 = false;
  const kept = lines.filter((l, i) => {
    if (i < 4 && /README\.(tr|en)\.md/.test(l) && /🇬🇧|🇹🇷|English|Türkçe/.test(l)) return false;
    if (!h1 && /^# /.test(l)) return !(h1 = true);
    return true;
  });
  const src = kept.join('\n');

  const sh = await highlighter();
  for (const m of src.matchAll(/^\s*```([\w#+-]+)/gm)) {
    const l = m[1].toLowerCase();
    if (l in bundledLanguages && !sh.getLoadedLanguages().includes(l)) await sh.loadLanguage(l as never);
  }

  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      code({ text, lang }) {
        const l = (lang ?? '').trim().split(/\s+/)[0].toLowerCase();
        const known = l && sh.getLoadedLanguages().includes(l);
        const inner = known
          ? sh
              .codeToHtml(text, {
                lang: l,
                themes: { light: 'github-light', dark: 'github-dark' },
                defaultColor: false,
              })
              .replace(/^<pre[^>]*>/, '<pre>')
          : `<pre><code>${esc(text)}</code></pre>`;
        return `<figure class="rd-code"><figcaption><span>${esc(l)}</span><button type="button" data-rd-copy>kopyala</button></figcaption>${inner}</figure>\n`;
      },
    },
  });
  let html = await marked.parse(src, { async: true });

  // göreli bağlantılar depodaki dosyaya gider, dış bağlantılar yeni sekmede açılır
  html = html.replace(/<a href="([^"]+)"/g, (_, u: string) => {
    if (u.startsWith('#')) return `<a href="${u}"`;
    const abs = isRel(u) ? (/\.[a-z0-9]+$/i.test(u) ? BLOB : TREE) + `posts/${id}/` + u.replace(/^\.\//, '') : u;
    return `<a href="${abs}" target="_blank" rel="noopener"`;
  });

  // görseller: depodaki SVG'ler sayfaya gömülür (animasyonları çalışır), diğerleri GitHub'dan yüklenir
  const imgs = [
    ...html.matchAll(/<p>\s*<img src="([^"]+)" alt="([^"]*)"[^>]*>\s*<\/p>|<img src="([^"]+)" alt="([^"]*)"[^>]*>/g),
  ];
  for (const m of imgs) {
    const u = m[1] ?? m[3];
    const alt = m[2] ?? m[4] ?? '';
    let out: string;
    const svg = isRel(u) && /\.svg$/i.test(u) ? await read(u.replace(/^\.\//, '')) : null;
    if (svg) {
      const body = svg
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<svg /, `<svg role="img" aria-label="${esc(alt)}" `);
      out = `<figure class="rd-fig rd-img">${body}${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}</figure>`;
    } else {
      const abs = isRel(u) ? `${RAW}posts/${id}/${u.replace(/^\.\//, '')}` : u;
      out = `<figure class="rd-fig rd-img"><img src="${abs}" alt="${esc(alt)}" loading="lazy" />${alt ? `<figcaption>${esc(alt)}</figcaption>` : ''}</figure>`;
    }
    html = html.replace(m[0], () => out);
  }

  html = html.replace(/<table>/g, '<div class="rd-table"><table>').replace(/<\/table>/g, '</table></div>');

  // içindekiler: ikinci düzey başlıklar
  const toc: [string, string][] = [];
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (_, t: string) => {
    const hid = `rd-s${toc.length + 1}`;
    toc.push([hid, t.replace(/<[^>]+>/g, '').trim()]);
    return `<h2 id="${hid}">${t}</h2>`;
  });

  // ilk alıntı "kim yazdı" notudur, ardından gelen ilk paragraf giriş cümlesi
  let by = '';
  html = html.replace(/^\s*<blockquote>([\s\S]*?)<\/blockquote>/, (_, t: string) => {
    by = `<div class="rd-by">${t}</div>`;
    return '';
  });
  html = by + html.replace(/<p>/, '<p class="rd-lead">');
  // örneklerdeki localhost adresleri bağlantı olmasın
  html = html.replace(/<a href="https?:\/\/(?:localhost|127\.0\.0\.1)[^"]*"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  const words = src
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return { html, toc, min: Math.max(1, Math.round(words / 190)) };
}

async function load(): Promise<SkyPost[]> {
  const dir = localDir();
  let source: { metas: Meta[]; read: (id: string) => ReadFile };
  try {
    source = dir ? await fromDir(dir) : await fromRemote();
  } catch (e) {
    // Yayın derlemesinde boş gökyüzü yayınlamaktansa derlemeyi durdur; bilgisayarda (çevrimdışı) boş göster.
    if (process.env.CI) throw e;
    console.warn(`[sky] ${(e as Error).message}. Gökyüzü boş gösterilecek.`);
    return [];
  }
  const out: SkyPost[] = [];
  for (const m of source.metas) {
    const read = source.read(m.id);
    const body = {} as SkyPost['body'];
    const min = {} as SkyPost['min'];
    for (const l of ['tr', 'en'] as const) {
      const md = (await read(`README.${l}.md`)) ?? (await read(`README.${l === 'tr' ? 'en' : 'tr'}.md`)) ?? '';
      const r = await render(md, m.id, read);
      body[l] = { html: r.html, toc: r.toc };
      min[l] = r.min;
    }
    out.push({ ...m, body, min, url: `${TREE}posts/${m.id}` });
  }
  // en yeni yazı en başta; aynı günün yazıları klasör adına göre
  out.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1));
  console.log(`[sky] ${out.length} yazı (${dir ? dir : RAW})`);
  return out;
}

let cache: Promise<SkyPost[]> | null = null;
export const loadSky = () => (cache ??= load());

/** Yazının sitedeki kendi sayfası: /yazi/<slug>/ (Türkçe) ve /en/post/<slug>/ (İngilizce). */
export const postPath = (p: { slug: Two }, l: Lang) => (l === 'en' ? `/en/post/${p.slug.en}/` : `/yazi/${p.slug.tr}/`);
/** Tüm yazılar sayfası. */
export const listPath = (l: Lang) => (l === 'en' ? '/en/posts/' : '/yazilar/');

/** Sayfaya gömülen hafif liste (yazı gövdeleri ayrı dosyalarda durur). */
export const skyIndex = (posts: SkyPost[]) =>
  posts.map((p) => ({
    id: p.id,
    date: p.date,
    topic: p.topic,
    title: p.title,
    summary: p.summary,
    tags: p.tags,
    min: p.min,
    url: p.url,
    path: { tr: postPath(p, 'tr'), en: postPath(p, 'en') },
  }));
