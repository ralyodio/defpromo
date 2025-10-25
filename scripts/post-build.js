#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const browser = process.env.BROWSER || 'chrome';

console.log(`Post-build for ${browser}...`);

const distDir = join('dist', browser);

// Ensure dist directory exists
mkdirSync(distDir, { recursive: true });

// Copy appropriate manifest based on browser
if (browser === 'firefox') {
  console.log('Copying Firefox-specific manifest...');
  if (existsSync('public/manifest.firefox.json')) {
    copyFileSync('public/manifest.firefox.json', join(distDir, 'manifest.json'));
    console.log('✓ Firefox manifest copied');
  }
} else if (browser === 'safari') {
  console.log('Copying Safari-specific manifest...');
  if (existsSync('public/manifest.safari.json')) {
    copyFileSync('public/manifest.safari.json', join(distDir, 'manifest.json'));
    console.log('✓ Safari manifest copied');
  }
} else {
  // Chrome/Edge - manifest.json is already copied by Vite plugin
  console.log('✓ Chrome/Edge manifest ready');
}

console.log(`✓ Build complete for ${browser}`);
console.log(`Output directory: ${distDir}\n`);

// Browser-specific instructions
if (browser === 'firefox') {
  console.log('📦 Firefox Build Ready!');
  console.log('To test in Firefox:');
  console.log('1. Go to about:debugging#/runtime/this-firefox');
  console.log('2. Click "Load Temporary Add-on"');
  console.log(`3. Select manifest.json in ${distDir}/ folder`);
} else if (browser === 'safari') {
  console.log('📦 Safari Build Ready!');
  console.log('To build Safari app:');
  console.log(`1. Run: xcrun safari-web-extension-converter ${distDir}/`);
  console.log('2. Open generated Xcode project');
  console.log('3. Build and run');
} else {
  console.log('📦 Chrome/Edge Build Ready!');
  console.log('To test in Chrome/Edge:');
  console.log('1. Go to chrome://extensions/');
  console.log('2. Enable Developer Mode');
  console.log('3. Click "Load unpacked"');
  console.log(`4. Select the ${distDir} folder`);
}