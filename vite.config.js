import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        // Copy manifest.json to dist
        copyFileSync('public/manifest.json', 'dist/manifest.json');
        
        // Create icons directory and copy icons
        try {
          mkdirSync('dist/icons', { recursive: true });
          const icons = readdirSync('public/icons');
          icons.forEach((icon) => {
            copyFileSync(`public/icons/${icon}`, `dist/icons/${icon}`);
          });
        } catch (e) {
          console.error('Error copying icons:', e);
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/service-worker.js'),
        'content-twitter': resolve(__dirname, 'src/content/twitter.js'),
        'content-linkedin': resolve(__dirname, 'src/content/linkedin.js'),
        'content-reddit': resolve(__dirname, 'src/content/reddit.js'),
        'content-facebook': resolve(__dirname, 'src/content/facebook.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.startsWith('content-')) {
            return 'content/[name].js';
          }
          if (chunkInfo.name === 'background') {
            return 'background/[name].js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    env: {
      NODE_ENV: 'test',
    },
  },
});