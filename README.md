# Learning Galaxy

## Çalıştırma

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # dist/ klasörüne derler
```

## Klasörler

- `src/pages/index.astro`: sayfanın bölümleri (giriş, hakkımda, gelişim, gökyüzü, iletişim)
- `src/pages/404.astro`: bulunamayan sayfa
- `src/data/site.ts`: metinler, deneyimler, beceriler, gezegenler ve Spotify çalma listeleri
- `src/data/sky.ts`: yazıları [learning-sky](https://github.com/zehrabetulcuhadar/learning-sky) deposundan okur. Bilgisayarda bu klasörün yanında `learning-sky` klasörü varsa oradan (henüz göndermediğin yazıları da görürsün), yoksa GitHub'dan alır. Yalnızca `status: "published"` olan ve tarihi gelmiş yazılar görünür. Sitede elle yazı tutulmaz.
- `src/components/`: açılış (`Intro.astro`), galaksideki yazı görünümü (`Reader.astro`) ve yazıların kendi sayfaları (`PostPage.astro`, `PostList.astro`, `PostShell.astro`)
- `src/pages/yazi/` ve `src/pages/en/post/`: her yazının arama motorlarının okuyabildiği kendi sayfası; `yazilar/` ve `en/posts/` tüm yazılar listesi
- `src/pages/sitemap.xml.ts`, `src/pages/rss.xml.ts`, `src/data/seo.ts`: site haritası, RSS ve yapısal veri (arama motorları için)
- `src/scripts/galaxy/`: 3D sahne; gezegen karakterleri `characters/` altında
- `src/scripts/intro.ts`: açılış animasyonları (varsayılan: kod editörü ve bomba)
- `src/scripts/theme-switch.ts`: gece gündüz düğmesindeki sahne
- `src/scripts/i18n.ts`: Türkçe ve İngilizce metinler
- `src/styles/`: renkler, temalar ve ortak düğme dili
- `design/gece-gunduz-dugmesi.html`: gece gündüz düğmesi için üç tasarım denemesi (yayına girmez)

## Kısayollar

- Açılışı yeniden izlemek için adresin sonuna `#kod`, `#terminal` ya da `#bomba` ekle.
- Her gezegende çok sayıda yazı olunca nasıl göründüğünü denemek için `#dolu` ekle.

## Yayın

`main` dalına her push'ta `.github/workflows/deploy.yml` siteyi derleyip yayınlar.
Repo ayarlarında **Settings → Pages → Source: GitHub Actions** seçili olmalı.

## Lisans

© 2026 Zehra Betül Çuhadar. Tüm hakları saklıdır. Bu depo açık kaynak değildir: kod, tasarım, karakterler, animasyonlar ve metinler izinsiz kopyalanamaz, değiştirilemez, dağıtılamaz ve ticari amaçla kullanılamaz. Ayrıntılar `LICENSE` dosyasında.

All rights reserved. This repository is not open source; see `LICENSE`.
