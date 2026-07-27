import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.js on purpose: keeps the real dev/build config
// (which loads the Tailwind Vite plugin) untouched. Component unit tests run
// under jsdom, which never parses real stylesheets, so the Tailwind plugin
// isn't needed here.
export default defineConfig({
  plugins: [react()],
  // Vitest's bundled internal Vite doesn't understand @vitejs/plugin-react v6's
  // oxc-based JSX config (meant for the top-level Vite 8 in vite.config.js), so
  // it silently falls back to the classic runtime and every .jsx file needs
  // `React` in scope. Forcing esbuild's own jsx handling here makes Vitest use
  // the automatic runtime regardless of what the plugin negotiates.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/design/test/setup.js'],
    exclude: ['**/node_modules/**', 'e2e/**'],
  },
});
