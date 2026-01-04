#!/usr/bin/env node
/**
 * Version bump script for DefPromo
 * Bumps version in package.json and all manifest files
 *
 * Usage:
 *   pnpm version:patch  - Bump patch version (1.4.6 -> 1.4.7)
 *   pnpm version:minor  - Bump minor version (1.4.6 -> 1.5.0)
 *   pnpm version:major  - Bump major version (1.4.6 -> 2.0.0)
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type BumpType = 'major' | 'minor' | 'patch';

interface PackageJson {
  version: string;
  [key: string]: unknown;
}

interface ManifestJson {
  version: string;
  [key: string]: unknown;
}

const FILES_TO_UPDATE = [
  'package.json',
  'public/manifest.json',
  'public/manifest.firefox.json',
  'public/manifest.safari.json',
];

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return parts as [number, number, number];
}

function bumpVersion(version: string, type: BumpType): string {
  const [major, minor, patch] = parseVersion(version);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
  }
}

function updateFile(filePath: string, newVersion: string): void {
  const fullPath = join(process.cwd(), filePath);
  const content = readFileSync(fullPath, 'utf-8');
  const json = JSON.parse(content) as PackageJson | ManifestJson;

  const oldVersion = json.version;
  json.version = newVersion;

  writeFileSync(fullPath, JSON.stringify(json, null, 2) + '\n');
  console.log(`  ✅ ${filePath}: ${oldVersion} → ${newVersion}`);
}

function main(): void {
  const bumpType = process.argv[2] as BumpType | undefined;

  if (!bumpType || !['major', 'minor', 'patch'].includes(bumpType)) {
    console.error('Usage: bump-version.ts <major|minor|patch>');
    process.exit(1);
  }

  // Read current version from package.json
  const packageJsonPath = join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, 'utf-8')
  ) as PackageJson;
  const currentVersion = packageJson.version;
  const newVersion = bumpVersion(currentVersion, bumpType);

  console.log(`\n🔄 Bumping version: ${currentVersion} → ${newVersion}\n`);

  for (const file of FILES_TO_UPDATE) {
    updateFile(file, newVersion);
  }

  console.log(`\n✅ Version bumped to ${newVersion}\n`);
}

main();
