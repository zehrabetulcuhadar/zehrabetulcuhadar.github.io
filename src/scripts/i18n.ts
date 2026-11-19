/**
 * Dil: Türkçe (varsayılan) ve İngilizce.
 * Sayfa Türkçe yazılır; İngilizce seçiliyse açılışta metinler aşağıdaki sözlükten çevrilir.
 * Dil değişince sayfa yeniden yüklenir (başlık harfleri, 3B etiketler gibi her şey baştan kurulur).
 * Yazıların kendisi learning-sky deposundan iki dilli gelir (src/data/sky.ts); buradaki sözlük yalnızca arayüz için.
 */
export type Lang = 'tr' | 'en';

const read = (): Lang => {
  try {
    const v = localStorage.getItem('lang');
    if (v === 'en' || v === 'tr') return v;
  } catch {
    /* gizli sekme */
  }
  return 'tr';
};
export const lang: Lang = read();

const EN: Record<string, string> = {
  // açılış
  'Açılış animasyonu oynuyor. Atlamak için Escape tuşuna basabilirsiniz.':
    'The intro animation is playing. Press Escape to skip it.',
  Atla: 'Skip',
  'Açılış animasyonunu atla': 'Skip the intro animation',
  'yıldız tozu toplanıyor': 'gathering stardust',
  'yerçekimi derleniyor': 'compiling gravity',
  'kahve yükleniyor': 'loading coffee',
  ' evren ': ' universe ',
  ' ateşleme ': ' ignition ',
  // üst bar, gözlemevi
  Lakabım: 'My nickname',
  'Gece ve gündüz arasında geç': 'Switch between night and day',
  Gözlemevi: 'Observatory',
  'Gözlemevi: teleskoptan bak': 'Observatory: look through the telescope',
  'Gözlemevini kapat': 'Close the observatory',
  Gezegen: 'Planet',
  'Konu gezegeni': 'Topic planet',
  Hobilerim: 'My hobbies',
  Bölüm: 'Section',
  'Yakından incele': 'Take a closer look',
  'Bölüme git': 'Go to section',
  'Bölüme git →': 'Go to section →',
  'Önceki gezegen': 'Previous planet',
  'Sonraki gezegen': 'Next planet',
  'Halkayı çevir ya da ← → ile gezegenler arasında dolaş': 'Turn the ring or use ← → to move between planets',
  'Halkayı parmağınla çevir, gezegenler arasında dolaş': 'Turn the ring with your finger to move between planets',
  // karşılama
  'Merhaba,': 'Hello,',
  'ben Zehra.': "I'm Zehra.",
  'Merhaba, ben Zehra.': "Hello, I'm Zehra.",
  'Galaksime hoş geldin.': 'Welcome to my galaxy.',
  Keşfet: 'Explore',
  'Galakside gez': 'Roam the galaxy',
  'ya da aşağı kaydır': 'or scroll down',
  'gezegenlere dokunabilirsin': 'you can touch the planets',
  // hakkımda
  Hakkımda: 'About me',
  'Yazılım geliştirme uzmanıyım.': "I'm a software developer.",
  'Kendimi geliştirmeye devam ediyorum; öğrendikçe galaksimi büyütüyorum.':
    'I keep learning, and my galaxy grows with everything I learn.',
  'Seyir Mobil · Yazılım Geliştirme Uzmanı': 'Seyir Mobil · Software Development Specialist',
  'Tam zamanlı · Temmuz 2024 - Günümüz': 'Full-time · July 2024 - Present',
  'Stajyer · Temmuz - Ağustos 2023': 'Intern · July - August 2023',
  'Stajyer · Temmuz 2022': 'Intern · July 2022',
  'İBB Bilgi İşlem Dairesi Başkanlığı · Front End Web Developer':
    'Istanbul Metropolitan Municipality, IT Department · Front End Web Developer',
  'Ön Uç Geliştirme': 'Front-End Development',
  'Ön uç': 'Front end',
  'Arka uç ve veri': 'Back end and data',
  // gelişim
  'Gelişim alanım': 'My growth area',
  'Altında ne var?': "What's underneath?",
  'İşimde kullandığım teknolojilerin altında ne olduğunu da bilmek istiyorum. İşlemciden işletim sistemine, ağdan veritabanına, oradan yazılım mimarisine kadar...':
    'I want to know what lies beneath the technologies I use at work. From the processor to the operating system, from networks to databases, and on to software architecture...',
  'Yapay zekâ artık kodun büyük kısmını yazabiliyor. Bu yüzden doğru soruyu sormak ve cevabı denetleyebilmek her zamankinden daha değerli; bu da işin altındakini ne kadar iyi bildiğime bağlı. Ben de bu alanı kişisel oyun parkım gibi kullanmaya karar verdim.':
    'AI can now write most of the code. That makes asking the right question and checking the answer more valuable than ever, and that depends on how well I know what lies underneath. So I decided to use this space as my personal playground.',
  'Öğrendiğim her konuyu kısa bir yazıya dönüştürüyorum. Her yazı bu gökyüzünde bir yıldız, her konu bir gezegen. Burası beni motive eden, gelişme hevesimi canlı tutan notlarımın yeri; herkese açık bir not defteri.':
    'I turn every topic I learn into a short post. Each post is a star in this sky, each topic a planet. This is where I keep the notes that motivate me and keep my urge to grow alive; a notebook open to everyone.',
  // gökyüzüm
  Gökyüzüm: 'My sky',
  'Galaksimi büyütmeye devam ediyorum.': 'I keep growing my galaxy.',
  'Her yıldız bir yazı. Bir gezegene dokun, yakından bak; bir yıldıza dokun, yazıyı oku.':
    'Every star is a post. Touch a planet to see it up close; touch a star to read the post.',
  'Galakside serbest gez': 'Roam the galaxy freely',
  'gezegen = konu': 'planet = topic',
  'yıldız = yazı': 'star = post',
  // iletişim
  'Bana ulaşın': 'Contact me',
  'Merhaba demek ister misin?': 'Want to say hello?',
  'Bir yazı hakkında söylemek istediğin bir şey mi var, ya da sadece merhaba mı demek istiyorsun? Buradayım. Gelişim önerilerine de her zaman açığım.':
    "Is there something you'd like to say about a post, or do you just want to say hello? I'm here. I'm always open to suggestions, too.",
  'Zehra tarafından, öğrenilirken yazılıyor ✦': 'Being written by Zehra, while learning ✦',
  'Açılışı yeniden izle:': 'Replay the intro:',
  bomba: 'bomb',
  kod: 'code',
  'Sayfa bulunamadı': 'Page not found',
  Karşılama: 'Welcome',
  Bölümler: 'Sections',
  // inceleme, gezinti
  'Gezegenin yazıları': "The planet's posts",
  Kapat: 'Close',
  'Canlandır ✦': 'Animate ✦',
  'sürükle: çevir · tekerlek: yakınlaş · ← →: sıradaki': 'drag: rotate · wheel: zoom · ← →: next',
  'sürükle: çevir · iki parmak: yakınlaş': 'drag: rotate · two fingers: zoom',
  'Serbest gezinti': 'Free roam',
  Bitir: 'Done',
  Yakınlaş: 'Zoom in',
  Uzaklaş: 'Zoom out',
  'Galaksinin tamamını göster': 'Show the whole galaxy',
  'sürükle: kaydır · tekerlek: yakınlaş · gezegene ya da yıldıza tıkla':
    'drag: pan · wheel: zoom · click a planet or a star',
  'sürükle: kaydır · iki parmak: yakınlaş · gezegene ya da yıldıza dokun':
    'drag: pan · two fingers: zoom · touch a planet or a star',
  'Bu gezegen sitenin bir bölümünü taşıyor.': 'This planet carries one section of the site.',
  'Bu gezegenin yıldızları yolda. İlk yazı geldiğinde burada görünecek.':
    "This planet's stars are on their way. The first post will appear here.",
  'İş dışında beni oyalayan şeylerden biri.': 'One of the things that keep me busy outside work.',
  Müzik: 'Music',
  Resim: 'Painting',
  Dergi: 'Magazines',
  yıldız: 'star',
  'Okumak için tıkla': 'Click to read',
  Güneş: 'Sun',
  Ay: 'Moon',
  '☀ Dokun, aya dönüşsün': '☀ Touch it to turn it into the moon',
  '☾ Dokun, güneş doğsun': '☾ Touch it and the sun will rise',
  'Ay kedi ☾': 'Moon cat ☾',
  'Uyuyor... 🐾': 'Sleeping... 🐾',
  'Dokun, güneş doğsun': 'Touch it and the sun will rise',
  'Kimliği belirsiz uçan cisim': 'Unidentified flying object',
  '👽 Yakalamak için tıkla!': '👽 Click to catch it!',
  'Yay takımyıldızı ♐︎': 'Sagittarius ♐︎',
  'Yay burcuyum, doğum günüm 25 Kasım 🎂': "I'm a Sagittarius, my birthday is 25 November 🎂",
  'Tıkla, kutlayalım!': "Click and let's celebrate!",
  '♐︎ Yay': '♐︎ Sagittarius',
  // okuma sayfası
  'Galaksiye dön': 'Back to the galaxy',
  'Bu yazıda': 'In this post',
  'Diğer yıldızlar': 'Other stars',
  'gezegeni ·': 'planet ·',
  'Son yıldızlar': 'Latest stars',
  '© 2026 Zehra Betül Çuhadar · Tüm hakları saklıdır': '© 2026 Zehra Betül Çuhadar · All rights reserved',
  'Tüm yazılar →': 'All posts →',
  'Yazının kendi sayfası →': "The post's own page →",
  "Bu yazı ve örnek kodu GitHub'da →": 'This post and its example code on GitHub →',
  'Yazıyı Türkçe oku': 'Read the post in Turkish',
  'Yazıyı İngilizce oku': 'Read the post in English',
  'Devamını göster': 'Show more',
  'Diğer gezegenler': 'More planets',
  kopyala: 'copy',
  'kopyalandı ✓': 'copied ✓',
  '← önceki yıldız': '← previous star',
  'sonraki yıldız →': 'next star →',
  'Galaksi JavaScript ile çiziliyor; metinler yine de okunabilir.':
    'The galaxy is drawn with JavaScript; the text can still be read.',
};

/** Türkçe metnin seçili dildeki karşılığı (sözlükte yoksa kendisi). */
export const L = (s: string) => (lang === 'en' ? (EN[s] ?? s) : s);

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
/** Boşluk farklarına takılmamak için: tüm boşluklar atılmış anahtarlar. */
const tight = (s: string) => s.replace(/\s+/g, '');
const EN_T: Record<string, string> = {};
for (const k in EN) EN_T[tight(k)] = EN[k];
const ATTRS = ['aria-label', 'title', 'data-part'];

/** Bir elemanın altındaki bütün metinleri ve etiket niteliklerini çevirir. */
export function translate(rootEl: Element) {
  if (lang !== 'en') return;
  const walk = (el: Element) => {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (v && EN[v]) el.setAttribute(a, EN[v]);
    }
    // içinde vurgulu sözcükler olan paragraflar: bütün olarak çevrilir
    if (el.children.length && !el.querySelector('svg, button, a, [id]')) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
      const whole = hasText ? EN_T[tight(el.textContent ?? '')] : undefined;
      if (whole) {
        el.innerHTML = whole;
        return;
      }
    }
    for (const n of [...el.childNodes]) {
      if (n.nodeType === 3) {
        const raw = n.textContent ?? '';
        const en = EN[norm(raw)];
        if (en) n.textContent = raw.replace(raw.trim(), en);
      } else if (n.nodeType === 1) walk(n as Element);
    }
  };
  walk(rootEl);
}

/** Dili değiştirir ve sayfayı o dilde yeniden kurar. */
export function setLang(l: Lang) {
  try {
    // dil değişirken tema asla değişmesin: o anki temayı da sakla
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'day' || t === 'night') localStorage.setItem('theme', t);
    localStorage.setItem('lang', l);
  } catch {
    /* gizli sekme */
  }
  location.reload();
}

document.documentElement.lang = lang;
translate(document.body);
