import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Single source of truth for the version: frontend/package.json. The footer derives the display X.XX.XXX form from it
// at build time (src/main.tsx), so the shell footer can never drift from the package version again.
const pkgVersion = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')).version as string;

// GitHub Pages has no SPA fallback: a direct hit / refresh on a client route returns the host 404 page. Copying the
// built index.html to 404.html makes Pages serve the app for any unknown path so the router can render deep links.
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const idx = resolve(__dirname, 'dist/index.html');
      if (existsSync(idx)) copyFileSync(idx, resolve(__dirname, 'dist/404.html'));
    },
  };
}

// Static SPA for GitHub Pages at corelog.fasl-work.com (custom domain → base '/').
export default defineConfig({
  base: '/',
  define: { __APP_VERSION__: JSON.stringify(pkgVersion) },
  plugins: [react(), spaFallback()],
  build: { target: 'es2022', outDir: 'dist', sourcemap: false },
});
