// Sitenin içerik verisi.
// Yazılar burada tutulmaz: learning-sky deposundan gelir (bkz. src/data/sky.ts).

export type Theme = 'day' | 'night';

export interface Planet {
  id: string;
  name: string;
  /** Gündüz (kil) ve gece renkleri */
  color: string;
  /** Gezegen yüzeyinin türü: shader bu türe göre desen çizer */
  surface: 'bands' | 'rocky' | 'swirl' | 'ice' | 'lava';
  ring?: boolean;
}

export interface Post {
  /** learning-sky deposundaki klasör adı (ör. 2026-11-17-cors-nedir) */
  id: string;
  title: string;
  planet: string;
  summary: string;
  /** YYYY-AA-GG */
  date: string;
  tags: string[];
  /** okuma süresi, dakika */
  min: number;
  /** iki dildeki başlık ve süre: okuma sayfasındaki TR · EN geçişi için */
  titles: Record<string, string>;
  mins: Record<string, number>;
  /** yazının GitHub'daki klasörü */
  url: string;
  /** "#dolu" denemesinin örnek yıldızı: okuma sayfası açılmaz */
  demo?: boolean;
}

export const topics: Planet[] = [
  { id: 'basics', name: 'Basics', color: '#F7C548', surface: 'bands' },
  { id: 'backend', name: 'Backend', color: '#F2766B', surface: 'rocky' },
  { id: 'frontend', name: 'Frontend', color: '#F28AC0', surface: 'swirl' },
  { id: 'data', name: 'Data', color: '#4FC7B8', surface: 'ice' },
  { id: 'quality', name: 'Quality', color: '#8FD694', surface: 'rocky' },
  { id: 'architecture', name: 'Architecture', color: '#7C8CF2', surface: 'bands', ring: true },
  { id: 'ai', name: 'AI', color: '#B79BF5', surface: 'swirl', ring: true },
  { id: 'english', name: 'English', color: '#F9A65A', surface: 'lava' },
  { id: 'news', name: 'News', color: '#6CC5EE', surface: 'ice' },
];

/** Hobilerim kuşağı: kişisel gezegenler. */
export const hobbies = [
  { id: 'music', name: 'Müzik', color: '#B79BF5' },
  { id: 'art', name: 'Resim', color: '#F28AC0' },
  { id: 'magazine', name: 'Dergi', color: '#F9A65A' },
];

/**
 * Spotify çalma listelerim: Müzik gezegeninde plak rafı olarak görünür.
 * `title` boş bırakılırsa plakta sıra numarası yazar; adını ve kapağını Spotify oynatıcısı zaten gösterir.
 */
export const playlists: { id: string; title?: string }[] = [
  { id: '0vEeJ9E6QaZgpI31jtgtXZ' },
  { id: '5x4NjnsPU4mQYRN2H1o71T' },
  { id: '6PM8vQjjSyb3UIS3FzzUo2' },
  { id: '6tEL6REetK2ZaCUdfFO5Me' },
  { id: '4Z06Ns7TsbKiwLtqtRCrpD' },
  { id: '53bImcKbZcEdUTuJuS6Kuc' },
  { id: '5b4UivCn1NtpeivdRHVC9m' },
  { id: '2UuvnnYOF9FRI1jSAnmwHv' },
  { id: '12odSvK1cN6XX6GfqeLvxz' },
  { id: '7KWxKXPW4Zhts2OmpGQ9Gg' },
  { id: '4HulCKVuSZSqeSRmei81Qu' },
];

/**
 * Yazılar learning-sky deposundan gelir: derleme sırasında src/data/sky.ts okur,
 * index.astro listeyi sayfaya gömer (#sky-data), burada o liste seçili dile göre açılır.
 * En yeni yazı en başta.
 */
export const posts: Post[] = (() => {
  if (typeof document === 'undefined') return [];
  try {
    let en = false;
    try {
      en = localStorage.getItem('lang') === 'en';
    } catch {
      /* gizli sekme */
    }
    const l = en ? 'en' : 'tr';
    const raw = JSON.parse(document.getElementById('sky-data')?.textContent || '[]') as {
      id: string;
      date: string;
      topic: string;
      title: Record<string, string>;
      summary: Record<string, string>;
      tags: string[];
      min: Record<string, number>;
      url: string;
    }[];
    return raw.map((p) => ({
      id: p.id,
      planet: p.topic,
      title: p.title[l] ?? p.title.tr,
      summary: p.summary[l] ?? p.summary.tr,
      date: p.date,
      tags: p.tags,
      min: p.min[l] ?? p.min.tr,
      titles: p.title,
      mins: p.min,
      url: p.url,
    }));
  } catch {
    return [];
  }
})();

export const sections = [
  { id: 'giris', label: 'Karşılama' },
  { id: 'hakkimda', label: 'Hakkımda' },
  { id: 'gelisim', label: 'Gelişim alanım' },
  { id: 'gokyuzu', label: 'Gökyüzüm' },
  { id: 'iletisim', label: 'Bana ulaşın' },
] as const;

export const experience = [
  {
    company: 'Seyir Mobil',
    role: 'Yazılım Geliştirme Uzmanı',
    meta: 'Tam zamanlı · Temmuz 2024 - Günümüz',
    skills: ['Angular', 'TypeScript', 'RxJS', '.NET', 'PostgreSQL', 'HTML', 'CSS', 'Ön Uç Geliştirme'],
  },
  {
    company: 'İBB Bilgi İşlem Dairesi Başkanlığı',
    role: 'Front End Web Developer',
    meta: 'Stajyer · Temmuz - Ağustos 2023',
    skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Ön Uç Geliştirme'],
  },
  {
    company: 'Seyir Mobil',
    role: 'Web Developer',
    meta: 'Stajyer · Temmuz 2022',
    skills: ['TypeScript', 'HTML', 'CSS'],
  },
];

export const skills = {
  front: [
    'Angular',
    'TypeScript',
    'JavaScript',
    'RxJS',
    'HTML',
    'CSS',
    'SCSS',
    'Bootstrap',
    'DevExtreme',
    'Chart.js',
    'PWA',
    'React',
  ],
  back: ['.NET', 'C#', 'PostgreSQL', 'SignalR'],
};

export const links = [
  { name: 'LinkedIn', handle: '/in/zehrabetulcuhadar', url: 'https://www.linkedin.com/in/zehrabetulcuhadar' },
  { name: 'GitHub', handle: '@zehrabetulcuhadar', url: 'https://github.com/zehrabetulcuhadar' },
  { name: 'Instagram', handle: '@zbcuhadar', url: 'https://www.instagram.com/zbcuhadar/' },
];

/** Badge'lerin sırayla aldığı renkler (pastel kil paleti) */
export const badgeColors = ['#F2766B', '#F9A65A', '#F7C548', '#8FD694', '#4FC7B8', '#6CC5EE', '#F28AC0', '#B79BF5'];

/** Doğum günü 'AA-GG' biçiminde (ör. '12-05'). O gün rehber kutlama yapar. Boş bırakılırsa kapalı. */
export const birthday = '11-25';

// Deneme: sayfa "#dolu" ile açılırsa her konuya 50-100 örnek yazı eklenir.
// Amaç, galaksinin yıllar sonra (çok yazıyla) nasıl görüneceğini şimdiden görebilmek.
if (typeof location !== 'undefined' && location.hash === '#dolu') {
  topics.forEach((t, i) => {
    const n = 50 + ((i * 37) % 51);
    const have = posts.filter((p) => p.planet === t.id).length;
    for (let k = have; k < n; k++)
      posts.push({
        id: `demo-${t.id}-${k}`,
        planet: t.id,
        title: `${t.name} notu ${k + 1}`,
        summary: '',
        date: '',
        tags: [],
        min: 0,
        titles: {},
        mins: {},
        url: '',
        demo: true,
      });
  });
}
