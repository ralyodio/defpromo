#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const contentDir = path.join(__dirname, '../src/content');
const filesToFix = [
  'linkedin.js',
  'primal.js',
  'facebook.js',
  'instagram.js',
  'threads.js',
  'youtube.js',
  'tiktok.js'
];

filesToFix.forEach(filename => {
  const filepath = path.join(contentDir, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`Skipping ${filename} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Check if already wrapped in IIFE
  if (content.trim().startsWith('(function()')) {
    console.log(`Skipping ${filename} - already wrapped in IIFE`);
    return;
  }
  
  console.log(`Processing ${filename}...`);
  
  // Extract platform name
  const platformMatch = filename.match(/^([a-z]+)\.js$/);
  const platform = platformMatch ? platformMatch[1] : 'unknown';
  const platformCap = platform.charAt(0).toUpperCase() + platform.slice(1);
  
  // Wrap in IIFE and move message listener to top
  const lines = content.split('\n');
  let newContent = `// ${platformCap} content script\n(function() {\n  'use strict';\n  \n`;
  
  // Add the initial log
  newContent += `  console.log('DefPromo: ${platformCap} content script loaded');\n\n`;
  
  // Add message listener at top
  newContent += `  // Register message listener IMMEDIATELY (before DOM ready)\n`;
  newContent += `  const api = typeof browser !== 'undefined' ? browser : chrome;\n`;
  newContent += `  api.runtime.onMessage.addListener((message, sender, sendResponse) => {\n`;
  newContent += `    console.log('${platformCap} content script received message:', message.type);\n`;
  newContent += `    if (message.type === 'GET_PAGE_CONTEXT') {\n`;
  newContent += `      const context = get${platformCap}PostContext();\n`;
  newContent += `      console.log('Responding with context:', context);\n`;
  newContent += `      sendResponse({ success: true, context });\n`;
  newContent += `      return true;\n`;
  newContent += `    }\n`;
  newContent += `  });\n\n`;
  
  // Process existing content, skip first comment line, indent everything, remove duplicate listener
  let skipNext = false;
  let inMessageListener = false;
  let messageListenerDepth = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip the initial console.log if it exists
    if (line.includes(`console.log('DefPromo: ${platformCap}`)) {
      continue;
    }
    
    // Detect and skip duplicate message listener block
    if (line.includes('// Listen for messages from sidebar')) {
      inMessageListener = true;
      continue;
    }
    
    if (inMessageListener) {
      if (line.includes('api.runtime.onMessage.addListener')) {
        messageListenerDepth++;
      }
      if (line.includes('});') && messageListenerDepth > 0) {
        messageListenerDepth--;
        if (messageListenerDepth === 0) {
          inMessageListener = false;
        }
      }
      continue;
    }
    
    // Skip duplicate api declaration
    if (line.trim().startsWith('const api = typeof browser')) {
      continue;
    }
    
    // Handle the init call at the end
    if (line.trim().startsWith('if (document.readyState')) {
      newContent += `  // Initialize when DOM is ready\n`;
      newContent += `  ${line.trim()}\n`;
      i++;
      while (i < lines.length && !lines[i].includes('}')) {
        newContent += `  ${lines[i].trim()}\n`;
        i++;
      }
      if (i < lines.length) {
        newContent += `  ${lines[i].trim()}\n`;
      }
      break;
    }
    
    // Indent all other lines
    if (line.trim()) {
      // Add proper indentation (2 spaces for IIFE wrapper)
      if (line.startsWith('  ')) {
        newContent += `  ${line}\n`;
      } else {
        newContent += `  ${line}\n`;
      }
    } else {
      newContent += '\n';
    }
  }
  
  // Close IIFE
  newContent += '})();\n';
  
  // Write back
  fs.writeFileSync(filepath, newContent, 'utf8');
  console.log(`✓ Fixed ${filename}`);
});

console.log('\n✅ All content scripts fixed!');

