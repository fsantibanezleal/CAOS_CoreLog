import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layers } from 'lucide-react';
import { AppShell, applyTheme, CitationsProvider, readTheme, useShellLang, type ShellConfig } from '@fasl-work/caos-app-shell';
import '@fasl-work/caos-app-shell/styles.css';
import './corelog.css';
import { CITATIONS } from './data/citations.ts';
import { architecture } from './architecture';
import Tool from './pages/Tool.tsx';
import Introduction from './pages/Introduction.tsx';
import Methodology from './pages/Methodology.tsx';
import Implementation from './pages/Implementation.tsx';
import Experiments from './pages/Experiments.tsx';
import Focus from './pages/Focus.tsx';
import Benchmark from './pages/Benchmark.tsx';

applyTheme(readTheme());

// Display version X.XX.XXX derived from package.json (via the vite `define`), the single source of truth.
declare const __APP_VERSION__: string;
const displayVersion = (() => {
  const [maj, min = '0', pat = '0'] = __APP_VERSION__.split('.');
  return `${maj}.${min.padStart(2, '0')}.${pat.padStart(3, '0')}`;
})();

const config: ShellConfig = {
  product: { name: 'CoreLog Vision', mark: <Layers size={18} aria-hidden="true" /> },
  routes: [
    { path: '/', en: 'App', es: 'App' },
    { path: '/introduction', en: 'Introduction', es: 'Introducción' },
    { path: '/methodology', en: 'Methodology', es: 'Metodología' },
    { path: '/implementation', en: 'Implementation', es: 'Implementación' },
    { path: '/experiments', en: 'Experiments', es: 'Experimentos' },
    { path: '/benchmark', en: 'Benchmark', es: 'Benchmark' },
  ],
  links: { github: 'https://github.com/fsantibanezleal/CAOS_CoreLog' },
  version: displayVersion,
  architecture,
};

// The document declares the language it is written in, on every route, the focus view included (it renders outside
// the shell). index.html hardcoded lang="es", so every English page declared Spanish, and the shell never writes the
// attribute (CAOS_MANAGE conventions/shell-known-defects.md, entry 4).
function DocumentLanguage(): null {
  const lang = useShellLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CitationsProvider items={CITATIONS}>
        <DocumentLanguage />
        <Routes>
          {/* ADR-0070: the focus view renders OUTSIDE the shell. */}
          <Route path="/focus/:caseId" element={<Focus />} />
          <Route path="*" element={
        <AppShell config={config}>
          <Routes>
            <Route path="/" element={<Tool />} />
            <Route path="/introduction" element={<Introduction />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/implementation" element={<Implementation />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/benchmark" element={<Benchmark />} />
            <Route path="*" element={<Tool />} />
          </Routes>
        </AppShell>
          } />
        </Routes>
      </CitationsProvider>
    </BrowserRouter>
  </StrictMode>,
);
