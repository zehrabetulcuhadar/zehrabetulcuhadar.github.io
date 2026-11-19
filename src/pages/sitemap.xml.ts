// Site haritası: arama motorlarına tüm sayfaları ve dil eşlerini bildirir.
import type { APIRoute } from 'astro';
import { listPath, loadSky, postPath } from '../data/sky';
import { SITE, xml } from '../data/seo';

export const GET: APIRoute = async () => {
  const posts = await loadSky();
  const last = posts[0]?.date;
  const pair = (tr: string, en: string, lastmod?: string) =>
    [tr, en]
      .map(
        (loc) =>
          `  <url>\n    <loc>${xml(SITE + loc)}</loc>\n` +
          (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') +
          `    <xhtml:link rel="alternate" hreflang="tr" href="${xml(SITE + tr)}"/>\n` +
          `    <xhtml:link rel="alternate" hreflang="en" href="${xml(SITE + en)}"/>\n` +
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(SITE + tr)}"/>\n  </url>`,
      )
      .join('\n');
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `  <url>\n    <loc>${SITE}/</loc>\n${last ? `    <lastmod>${last}</lastmod>\n` : ''}  </url>\n` +
    pair(listPath('tr'), listPath('en'), last) +
    '\n' +
    posts.map((p) => pair(postPath(p, 'tr'), postPath(p, 'en'), p.date)).join('\n') +
    `\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
