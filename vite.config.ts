import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Viaggi di gruppo',
        short_name: 'Viaggi',
        description: 'Documenti, prenotazioni e spese condivise del viaggio, anche offline.',
        lang: 'it',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F3F5F7',
        theme_color: '#0E6B58',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: base + 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          { urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//, handler: 'CacheFirst', options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 31536000 } } },
          { urlPattern: /^https:\/\/cdn\.jsdelivr\.net\//, handler: 'CacheFirst', options: { cacheName: 'ocr-engine', expiration: { maxEntries: 30, maxAgeSeconds: 31536000 } } },
          { urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\//, handler: 'CacheFirst', options: { cacheName: 'ocr-lang', expiration: { maxEntries: 10, maxAgeSeconds: 31536000 } } },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1500 },
});
