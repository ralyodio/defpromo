#!/usr/bin/env node

import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const browser = process.argv[2] || 'chrome';

console.log(`Post-build for ${browser}...`);

const distDir = 'dist';

// Copy manifest based on browser
if (browser === 'firefox') {
  console.log('Using Firefox manifest...');
  if (existsSync('public/manifest.firefox.json')) {
    copyFileSync('public/manifest.firefox.json', join(distDir, 'manifest.json'));
    console.log('✓ Firefox manifest copied');
  }
} else {
  console.log('Using Chrome manifest (already copied by Vite)');
}

console.log(`✓ Build complete for ${browser}`);
console.log(`Output directory: ${distDir}`);

if (browser === 'firefox') {
  console.log('\nTo test in Firefox:');
  console.log('1. Go to about:debugging#/runtime/this-firefox');
  console.log('2. Click "Load Temporary Add-on"');
  console.log(`3. Select ${distDir}/manifest.json`);
} else {
  console.log('\nTo test in Chrome/Edge:');
  console.log('1. Go to chrome://extensions/');
  console.log('2. Enable Developer Mode');
  console.log('3. Click "Load unpacked"');
  console.log(`4. Select the ${distDir} folder`);
}