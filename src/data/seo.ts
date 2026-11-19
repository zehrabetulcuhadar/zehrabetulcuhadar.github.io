// Arama motorları için yapısal veri (schema.org). Yalnızca derleme sırasında kullanılır.
import { links } from './site';
import { postPath, type Lang, type SkyPost } from './sky';

export const SITE = 'https://zehrabetulcuhadar.github.io';
export const AUTHOR = 'Zehra Betül Çuhadar';

export const person = {
  '@type': 'Person',
  '@id': `${SITE}/#zehra`,
  name: AUTHOR,
  alternateName: 'Zero',
  url: `${SITE}/`,
  jobTitle: 'Yazılım Geliştirme Uzmanı',
  knowsAbout: ['Angular', 'TypeScript', '.NET', 'C#', 'PostgreSQL', 'Web development'],
  sameAs: links.map((l) => l.url),
};

export const website = {
  '@type': 'WebSite',
  '@id': `${SITE}/#site`,
  name: 'Learning Galaxy by Zero',
  url: `${SITE}/`,
  inLanguage: ['tr', 'en'],
  author: { '@id': `${SITE}/#zehra` },
};

export const homeLd = { '@context': 'https://schema.org', '@graph': [website, person] };

export const postLd = (p: SkyPost, l: Lang, topic: string) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'BlogPosting',
      '@id': `${SITE}${postPath(p, l)}#post`,
      headline: p.title[l],
      description: p.summary[l],
      inLanguage: l,
      datePublished: `${p.date}T09:00:00+03:00`,
      dateModified: `${p.date}T09:00:00+03:00`,
      url: `${SITE}${postPath(p, l)}`,
      mainEntityOfPage: `${SITE}${postPath(p, l)}`,
      image: `${SITE}/og.png`,
      articleSection: topic,
      keywords: p.tags.join(', '),
      timeRequired: `PT${p.min[l]}M`,
      author: { '@id': `${SITE}/#zehra` },
      publisher: { '@id': `${SITE}/#zehra` },
      isPartOf: { '@id': `${SITE}/#site` },
    },
    person,
    website,
  ],
});

export const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
