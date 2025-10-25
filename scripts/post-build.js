#!/usr/bin/env node

import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

const browser = process.argv[2] || 'chrome';

console.log(`Post-build for ${browser}...`);

const distDir = 'dist';

// Copy Firefox manifest if building for Firefox
if (browser === 'firefox') {
  console.log('Copying Firefox-specific manifest...');
  if (existsSync('public/manifest.firefox.json')) {
    // Replace manifest.json with Firefox version
    copyFileSync('public/manifest.firefox.json', join(distDir, 'manifest.json'));
    console.log('✓ Firefox manifest copied to dist/manifest.json');
    
    // Also keep a copy as manifest.firefox.json
    copyFileSync('public/manifest.firefox.json', join(distDir, 'manifest.firefox.json'));
    console.log('✓ Firefox manifest copied to dist/manifest.firefox.json');
  }
}

// Copy Safari manifest if building for Safari
if (browser === 'safari') {
  console.log('Copying Safari-specific manifest...');
  if (existsSync('public/manifest.safari.json')) {
    copyFileSync('public/manifest.safari.json', join(distDir, 'manifest.json'));
    console.log('✓ Safari manifest copied to dist/manifest.json');
    
    copyFileSync('public/manifest.safari.json', join(distDir, 'manifest.safari.json'));
    console.log('✓ Safari manifest copied to dist/manifest.safari.json');
  }
}

console.log(`✓ Build complete for ${browser}`);
console.log(`Output directory: ${distDir}`);

if (browser === 'firefox') {
  console.log('\n📦 Firefox Build Ready!');
  console.log('To test in Firefox:');
  console.log('1. Go to about:debugging#/runtime/this-firefox');
  console.log('2. Click "Load Temporary Add-on"');
  console.log(`3. Select ANY manifest file in ${distDir}/ folder`);
  console.log('\n⚠️  NOTE: dist/manifest.json is now Manifest V2 for Firefox');
  console.log('⚠️  To use Chrome again, rebuild with: pnpm build or pnpm build:chrome');
} else if (browser === 'safari') {
  console.log('\n📦 Safari Build Ready!');
  console.log('To build Safari app:');
  console.log('1. Run: xcrun safari-web-extension-converter dist/');
  console.log('2. Open generated Xcode project');
  console.log('3. Build and run');
} else {
  console.log('\n📦 Chrome/Edge Build Ready!');
  console.log('To test in Chrome/Edge:');
  console.log('1. Go to chrome://extensions/');
  console.log('2. Enable Developer Mode');
  console.log('3. Click "Load unpacked"');
  console.log(`4. Select the ${distDir} folder`);
}