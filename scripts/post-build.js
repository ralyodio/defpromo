#!/usr/bin/env node

import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const browser = process.argv[2] || 'chrome';

console.log(`Post-build for ${browser}...`);

const distDir = 'dist';

// Copy Firefox manifests if building for Firefox
if (browser === 'firefox') {
  console.log('Copying Firefox-specific manifests...');
  if (existsSync('public/manifest.firefox.json')) {
    copyFileSync('public/manifest.firefox.json', join(distDir, 'manifest.firefox.json'));
    console.log('✓ Firefox Manifest V3 copied to dist/manifest.firefox.json');
  }
  if (existsSync('public/manifest.firefox.v2.json')) {
    copyFileSync('public/manifest.firefox.v2.json', join(distDir, 'manifest.firefox.v2.json'));
    console.log('✓ Firefox Manifest V2 copied to dist/manifest.firefox.v2.json');
  }
}

console.log(`✓ Build complete for ${browser}`);
console.log(`Output directory: ${distDir}`);

if (browser === 'firefox') {
  console.log('\n📦 Firefox Build Ready!');
  console.log('To test in Firefox:');
  console.log('1. Go to about:debugging#/runtime/this-firefox');
  console.log('2. Click "Load Temporary Add-on"');
  console.log(`3. Select ${distDir}/manifest.firefox.json`);
  console.log('\nNote: Use manifest.firefox.json for Firefox compatibility');
} else {
  console.log('\n📦 Chrome/Edge Build Ready!');
  console.log('To test in Chrome/Edge:');
  console.log('1. Go to chrome://extensions/');
  console.log('2. Enable Developer Mode');
  console.log('3. Click "Load unpacked"');
  console.log(`4. Select the ${distDir} folder`);
}