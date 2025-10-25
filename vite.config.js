import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
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