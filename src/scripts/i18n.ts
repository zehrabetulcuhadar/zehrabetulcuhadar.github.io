/**
 * Dil: Türkçe (varsayılan) ve İngilizce.
 * Sayfa Türkçe yazılır; İngilizce seçiliyse açılışta metinler aşağıdaki sözlükten çevrilir.
 * Dil değişince sayfa yeniden yüklenir (başlık harfleri, 3B etiketler gibi her şey baştan kurulur).
 * Yazıların kendisi ileride sky.json'daki iki dilli alanlardan gelecek; buradaki sözlük arayüz ve örnek yazı için.
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
  'Yapay zekâ artık kodun büyük kısmını yazabiliyor.': 'AI can now write most of the code.',
  'Öğrendiğim her konuyu kısa bir yazıya dönüştürüyorum. Her yazı bu gökyüzünde bir yıldız, her konu bir gezegen. Burası hem kendimi motive ettiğim yer, hem de açık bir not defteri.':
    'I turn every topic I learn into a short post. Each post is a star in this sky, each topic a planet. This is where I keep myself motivated, and it is also an open notebook.',
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
  'örnek yıldız': 'sample star',
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
  'Üç ana parça': 'Three main parts',
  'Mutfak benzetmesi': 'The kitchen analogy',
  'Bir programı açınca ne olur?': 'What happens when you open a program?',
  'Kodda nasıl görünür?': 'What does it look like in code?',
  'Aklında kalsın': 'Keep in mind',
  'Örnek yazı: tasarımı görebilmen için hazırlandı.': 'Sample post: written so you can see the design.',
  'Bu yıldızın yazısı henüz yazılmadı. Tasarımı görebilmen için örnek içerik gösteriliyor.':
    "This star's post has not been written yet. Sample content is shown so you can see the design.",
  'gezegeni ·': 'planet ·',
  '24 Kasım 2026': '24 November 2026',
  '6 dk okuma': '6 min read',
  'Her gün kullandığımız bilgisayarın içinde aslında çok sade bir düzen var: düşünen bir parça, o an üzerinde çalışılan şeyleri tutan bir parça ve her şeyi kalıcı olarak saklayan bir parça. Bu yazıda bu üçünü tanıyacağız.':
    'Inside the computer we use every day there is a very simple arrangement: one part that thinks, one part that holds whatever is being worked on right now, and one part that stores everything permanently. In this post we will meet all three.',
  'Bir programı çalıştırmak, bir tarifi uygulamaya benzer. Tarif (program) bir yerde durur, biri onu adım adım okur ve uygular, bu sırada da malzemeler tezgâhın üzerinde bekler. Bilgisayarda bu rolleri üç parça üstlenir:':
    'Running a program is like following a recipe. The recipe (the program) sits somewhere, someone reads and follows it step by step, and meanwhile the ingredients wait on the counter. In a computer, three parts play these roles:',
  'İşlemci CPU Komutları tek tek okuyup uygulayan parça. Saniyede milyarlarca küçük işlem yapar.':
    '<b>Processor <small>CPU</small></b> The part that reads and carries out instructions one by one. It performs billions of tiny operations per second.',
  'Bellek RAM O an çalışan programların verisini tutar. Çok hızlıdır ama bilgisayar kapanınca boşalır.':
    '<b>Memory <small>RAM</small></b> Holds the data of the programs running right now. It is very fast, but it empties when the computer turns off.',
  'Disk SSD / HDD Dosyaları ve programları kalıcı olarak saklar. Bellekten yavaştır ama unutmaz.':
    '<b>Disk <small>SSD / HDD</small></b> Stores files and programs permanently. Slower than memory, but it does not forget.',
  Bellek: 'Memory',
  İşlemci: 'Processor',
  'kalıcı depo': 'permanent storage',
  'çalışma tezgâhı': 'the counter',
  'işi yapan': 'does the work',
  yükle: 'load',
  oku: 'read',
  yaz: 'write',
  'Disk, bellek ve işlemci arasındaki veri akışı': 'Data flow between disk, memory and processor',
  'Program diskten belleğe yüklenir; işlemci belleği okur, sonucu yine belleğe yazar.':
    'The program is loaded from disk into memory; the processor reads memory and writes the result back to it.',
  Benzetme: 'Analogy',
  'Disk kiler, bellek tezgâh, işlemci ise aşçı. Aşçı kilerde yemek yapamaz; önce malzemeyi tezgâha alır. Tezgâh küçükse sürekli kilere gidip gelmek zorunda kalır ve mutfak yavaşlar.':
    'The disk is the <em>pantry</em>, memory is the <em>counter</em>, and the processor is the <em>cook</em>. The cook cannot cook in the pantry; the ingredients go onto the counter first. If the counter is small, the cook has to keep walking to the pantry and the kitchen slows down.',
  'Bilgisayarın “kasması” çoğu zaman tam olarak budur: bellek dolduğunda işletim sistemi, tezgâhta yer açmak için bazı şeyleri geçici olarak diske taşır. Disk bellekten çok daha yavaş olduğu için her şey ağırlaşır. Buna takas (swap) denir.':
    'When a computer “lags”, this is usually exactly what is happening: once memory is full, the operating system temporarily moves some things to disk to free up the counter. The disk is far slower than memory, so everything drags. This is called <strong>swapping</strong>.',
  'Hız sıralaması hep aynıdır: işlemcinin kendi küçük hafızası en hızlı, sonra bellek, en son disk. Hızlandıkça pahalanır ve küçülür.':
    "The order of speed never changes: the processor's own small memory is fastest, then RAM, then disk. The faster it gets, the more expensive and the smaller it is.",
  'Simgeye çift tıklarsın. İşletim sistemi programın dosyasını diskte bulur.':
    "You double-click the icon. The operating system finds the program's file <strong>on disk</strong>.",
  'Dosyanın gerekli kısımları belleğe kopyalanır.':
    'The parts that are needed are copied <strong>into memory</strong>.',
  'İşlemci, bellekteki ilk komuttan başlayarak sırayla okur ve uygular: getir, çöz, çalıştır.':
    '<strong>The processor</strong> starts from the first instruction in memory and works through them in order: fetch, decode, execute.',
  'Sen “Kaydet” deyince, bellekteki veri kalıcı olması için tekrar diske yazılır.':
    'When you hit “Save”, the data in memory is written back <strong>to disk</strong> so that it lasts.',
  Hız: 'Speed',
  Kapasite: 'Capacity',
  Kapanınca: 'When turned off',
  'İşlemci önbelleği': 'Processor cache',
  'en hızlı': 'fastest',
  'birkaç MB': 'a few MB',
  silinir: 'erased',
  'Bellek (RAM)': 'Memory (RAM)',
  hızlı: 'fast',
  yavaş: 'slow',
  '256 GB ve üstü': '256 GB and up',
  kalır: 'kept',
  'Günlük kod yazarken bu üçlüyle sürekli karşılaşırız, sadece adını koymayız. Aşağıdaki küçük örnekte sayilar dizisi bellekte durur, döngüyü işlemci çalıştırır, writeFile ise sonucu diske yazar.':
    'We meet this trio all the time in everyday code; we just do not name it. In the small example below, the <code>sayilar</code> array lives in memory, the processor runs the loop, and <code>writeFile</code> writes the result to disk.',
  kopyala: 'copy',
  'kopyalandı ✓': 'copied ✓',
  "// bellek: dizi, program çalıştığı sürece RAM'de durur":
    '// memory: the array stays in RAM for as long as the program runs',
  '// işlemci: her adımda bir toplama komutu çalıştırır': '// processor: runs one addition instruction per step',
  '// disk: sonuç kalıcı olsun diye dosyaya yazılır': '// disk: the result is written to a file so that it lasts',
  'İşlemci düşünür, bellek o anki işi tutar, disk saklar.':
    'The processor thinks, memory holds the current work, the disk stores.',
  'Bellek hızlıdır ama geçicidir; disk yavaştır ama kalıcıdır.':
    'Memory is fast but temporary; the disk is slow but permanent.',
  'Bellek dolarsa bilgisayar diski tezgâh gibi kullanmaya başlar ve yavaşlar.':
    'If memory fills up, the computer starts using the disk as its counter and slows down.',
  '#donanım': '#hardware',
  '#temeller': '#basics',
  '#bellek': '#memory',
  '← önceki yıldız': '← previous star',
  'sonraki yıldız →': 'next star →',
  'Galaksi JavaScript ile çiziliyor; metinler yine de okunabilir.':
    'The galaxy is drawn with JavaScript; the text can still be read.',
  // örnek yazı başlıkları
  'Bilgisayar nasıl çalışır? İşlemci, bellek ve disk nedir?':
    'How does a computer work? What are the processor, memory and disk?',
  'İkili sayı sistemi nedir?': 'What is the binary number system?',
  'İşletim sistemi nedir? Süreç ve thread farkı': 'What is an operating system? Processes vs. threads',
  'Stack ve heap farkı nedir?': 'What is the difference between the stack and the heap?',
  'Derleyici nedir? Yorumlayıcıdan farkı ne?': 'What is a compiler? How does it differ from an interpreter?',
  "C#'ta değer tipi ve referans tipi nedir?": 'What are value types and reference types in C#?',
  'Generics nedir? Neden List<T>?': 'What are generics? Why List<T>?',
  'LINQ nasıl çalışır?': 'How does LINQ work?',
  'TypeScript tip sistemi nasıl çalışır?': 'How does the TypeScript type system work?',
  'Generics, union ve type guard': 'Generics, unions and type guards',
  'Angular nasıl çalışır?': 'How does Angular work?',
  'Terminal nedir? Kabuk ve PATH': 'What is a terminal? The shell and PATH',
  'Git nasıl çalışır?': 'How does Git work?',
  'Yapay zekâ, makine öğrenmesi ve derin öğrenme farkı':
    'AI, machine learning and deep learning: what is the difference?',
  'Büyük dil modeli (LLM) nedir?': 'What is a large language model (LLM)?',
  'Token nedir? Bağlam penceresi neden önemli?': 'What is a token? Why does the context window matter?',
  'Halüsinasyon nedir?': 'What is a hallucination?',
  'Kasım-Aralık ayının yazılım haberleri': 'Software news of November and December',
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
