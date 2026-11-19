// RSS beslemesi: /rss.xml (Türkçe) ve /en/rss.xml (İngilizce).
import { listPath, loadSky, postPath, type Lang } from './sky';
import { AUTHOR, SITE, xml } from './seo';
import { topics } from './site';

export async function rss(lang: Lang) {
  const posts = await loadSky();
  const en = lang === 'en';
  const self = SITE + (en ? '/en/rss.xml' : '/rss.xml');
  const items = posts
    .map((p) => {
      const url = SITE + postPath(p, lang);
      return (
        `    <item>\n      <title>${xml(p.title[lang])}</title>\n      <link>${xml(url)}</link>\n` +
        `      <guid isPermaLink="true">${xml(url)}</guid>\n` +
        `      <pubDate>${new Date(p.date + 'T06:00:00Z').toUTCString()}</pubDate>\n` +
        `      <dc:creator>${AUTHOR}</dc:creator>\n` +
        `      <category>${xml(topics.find((t) => t.id === p.topic)?.name ?? p.topic)}</category>\n` +
        `      <description>${xml(p.summary[lang])}</description>\n    </item>`
      );
    })
    .join('\n');
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n  <channel>\n` +
    `    <title>Learning Galaxy by Zero</title>\n    <link>${SITE + listPath(lang)}</link>\n` +
    `    <description>${xml(en ? 'Notes by Zehra Betül Çuhadar on software fundamentals, frontend, backend, architecture and AI.' : 'Zehra Betül Çuhadar’ın yazılım temelleri, frontend, backend, mimari ve yapay zekâ üzerine notları.')}</description>\n` +
    `    <language>${lang}</language>\n    <atom:link href="${self}" rel="self" type="application/rss+xml"/>\n` +
    (posts[0] ? `    <lastBuildDate>${new Date(posts[0].date + 'T06:00:00Z').toUTCString()}</lastBuildDate>\n` : '') +
    items +
    `\n  </channel>\n</rss>\n`;
  return new Response(body, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
