import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://zehrabetulcuhadar.github.io',
  devToolbar: { enabled: false },
  // satır sonlarındaki boşluklar korunur (yoksa "örnekte<code>" gibi yerlerde sözcükler birbirine yapışıyor)
  compressHTML: false,
});
