import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';

export default defineConfig({
  publicDir: false, // Disable automatic public directory copying
  plugins: [
    react(),
    {
      name: 'copy-manifest',
      closeBundle() {
        const browser = process.env.BROWSER || 'chrome';
        const distDir = `dist/${browser}`;
        
        // Copy browser-specific manifest
        const manifestSource = browser === 'firefox' 
          ? 'public/manifest.firefox.json'
          : browser === 'safari'
          ? 'public/manifest.safari.json'
          : 'public/manifest.json';
        
        copyFileSync(manifestSource, `${distDir}/manifest.json`);
        
        // Create icons directory and copy icons
        try {
          mkdirSync(`${distDir}/icons`, { recursive: true });
          const icons = readdirSync('public/icons');
          icons.forEach((icon) => {
            copyFileSync(`public/icons/${icon}`, `${distDir}/icons/${icon}`);
          });
        } catch (e) {
          console.error('Error copying icons:', e);
        }
      },
    },
  ],
  build: {
    outDir: process.env.BROWSER ? `dist/${process.env.BROWSER}` : 'dist/chrome',
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'src/sidebar/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        popup: resolve(__dirname, 'src/popup/index.html'),
        background: resolve(__dirname, 'src/background/service-worker.js'),
        'background-firefox': resolve(__dirname, 'src/background/background-firefox.js'),
        'content-sidebar-injector': resolve(__dirname, 'src/content/sidebar-injector.js'),
        'content-twitter': resolve(__dirname, 'src/content/twitter.js'),
        'content-linkedin': resolve(__dirname, 'src/content/linkedin.js'),
        'content-reddit': resolve(__dirname, 'src/content/reddit.js'),
        'content-facebook': resolve(__dirname, 'src/content/facebook.js'),
        'content-tiktok': resolve(__dirname, 'src/content/tiktok.js'),
        'content-instagram': resolve(__dirname, 'src/content/instagram.js'),
        'content-threads': resolve(__dirname, 'src/content/threads.js'),
        'content-youtube': resolve(__dirname, 'src/content/youtube.js'),
        'content-stacker': resolve(__dirname, 'src/content/stacker.js'),
        'content-bluesky': resolve(__dirname, 'src/content/bluesky.js'),
        'content-primal': resolve(__dirname, 'src/content/primal.js'),
        'content-slack': resolve(__dirname, 'src/content/slack.js'),
        'content-discord': resolve(__dirname, 'src/content/discord.js'),
        'content-telegram': resolve(__dirname, 'src/content/telegram.js'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.startsWith('content-')) {
            return 'content/[name].js';
          }
          if (chunkInfo.name === 'background') {
            return 'background/service-worker.js';
          }
          if (chunkInfo.name === 'background-firefox') {
            return 'background/[name].js';
          }
          return '[name]/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
    emptyOutDir: true,
    minify: false, // Disable minification to prevent variable name collisions in content scripts
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