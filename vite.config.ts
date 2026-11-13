/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = 'locale';
try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* fuori da git */ }

// PWA: aggiornamento a "prompt" — il nuovo service worker resta in attesa finché
// l'utente non sceglie di aggiornare (mai durante una seduta o con input non salvato).
export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_DATE__: JSON.stringify(new Date().toISOString()), __COMMIT__: JSON.stringify(commit) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Diario Palestra & Cucina',
        short_name: 'Diario',
        description: 'Diario personale offline: allenamento, cibo, dispensa, spesa, sonno.',
        lang: 'it',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#16181c',
        theme_color: '#16181c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true // pulisce solo le cache di Workbox, MAI IndexedDB
      },
      devOptions: { enabled: false }
    })
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
