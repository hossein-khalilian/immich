import { enhancedImages } from '@sveltejs/enhanced-img';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import path from 'node:path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type ProxyOptions, type UserConfig } from 'vite';

const upstream = {
  target: process.env.IMMICH_SERVER_URL || 'http://localhost:2283/',
  secure: false, // Set to false for local development
  changeOrigin: true,
  logLevel: 'info',
  ws: true,
  // Allow self-signed certificates for local development
  configure: (proxy, _options) => {
    proxy.on('error', (err, _req, _res) => {
      console.log('Proxy error:', err);
    });
    proxy.on('proxyReq', (proxyReq, req, _res) => {
      console.log('Proxying:', req.method, req.url, '->', proxyReq.getHeader('host'));
    });
  },
};

const proxy: Record<string, string | ProxyOptions> = {
  '/api': upstream,
  '/.well-known/immich': upstream,
  '/custom.css': upstream,
};

export default defineConfig({
  build: {
    target: 'es2022',
  },
  resolve: {
    alias: {
      'xmlhttprequest-ssl': './node_modules/engine.io-client/lib/xmlhttprequest.js',
      // eslint-disable-next-line unicorn/prefer-module
      '@test-data': path.resolve(__dirname, './src/test-data'),
      // '@immich/ui': path.resolve(__dirname, '../../ui'),
    },
  },
  server: {
    // connect to a remote backend during web-only development
    proxy,
    allowedHosts: true,
    // When deployed behind a reverse proxy, HMR must use the public URL.
    // Set VITE_HMR_HOST (e.g. gallery.abrishamerp.ir) and optionally
    // VITE_HMR_PORT (443 for HTTPS) and VITE_HMR_PROTOCOL (wss) in .env
    hmr:
      process.env.VITE_HMR_HOST
        ? {
            host: process.env.VITE_HMR_HOST,
            port: Number(process.env.VITE_HMR_PORT || 443),
            protocol: (process.env.VITE_HMR_PROTOCOL as 'ws' | 'wss') || 'wss',
          }
        : true,
  },
  preview: {
    proxy,
  },
  plugins: [
    enhancedImages(),
    tailwindcss(),
    sveltekit(),
    process.env.BUILD_STATS === 'true'
      ? visualizer({
          emitFile: true,
          filename: 'stats.html',
        })
      : undefined,
    svelteTesting(),
  ],
  optimizeDeps: {
    entries: ['src/**/*.{svelte,ts,html}'],
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./src/test-data/setup.ts'],
    sequence: {
      hooks: 'list',
    },
  },
} as UserConfig);
