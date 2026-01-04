import { describe, it, expect } from 'vitest';

// Test the version parsing and bumping logic
// These are pure functions extracted for testing

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return parts as [number, number, number];
}

type BumpType = 'major' | 'minor' | 'patch';

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

describe('parseVersion', () => {
  it('should parse valid semver version', () => {
    expect(parseVersion('1.4.6')).toEqual([1, 4, 6]);
  });

  it('should parse version with zeros', () => {
    expect(parseVersion('0.0.0')).toEqual([0, 0, 0]);
  });

  it('should parse large version numbers', () => {
    expect(parseVersion('10.20.30')).toEqual([10, 20, 30]);
  });

  it('should throw on invalid version format - too few parts', () => {
    expect(() => parseVersion('1.4')).toThrow('Invalid version format: 1.4');
  });

  it('should throw on invalid version format - too many parts', () => {
    expect(() => parseVersion('1.4.6.7')).toThrow(
      'Invalid version format: 1.4.6.7'
    );
  });

  it('should throw on non-numeric parts', () => {
    expect(() => parseVersion('1.4.x')).toThrow('Invalid version format: 1.4.x');
  });

  it('should throw on empty string', () => {
    expect(() => parseVersion('')).toThrow('Invalid version format: ');
  });
});

describe('bumpVersion', () => {
  describe('patch bump', () => {
    it('should bump patch version', () => {
      expect(bumpVersion('1.4.6', 'patch')).toBe('1.4.7');
    });

    it('should bump patch from zero', () => {
      expect(bumpVersion('1.0.0', 'patch')).toBe('1.0.1');
    });

    it('should handle large patch numbers', () => {
      expect(bumpVersion('1.4.99', 'patch')).toBe('1.4.100');
    });
  });

  describe('minor bump', () => {
    it('should bump minor version and reset patch', () => {
      expect(bumpVersion('1.4.6', 'minor')).toBe('1.5.0');
    });

    it('should bump minor from zero', () => {
      expect(bumpVersion('1.0.0', 'minor')).toBe('1.1.0');
    });

    it('should handle large minor numbers', () => {
      expect(bumpVersion('1.99.5', 'minor')).toBe('1.100.0');
    });
  });

  describe('major bump', () => {
    it('should bump major version and reset minor and patch', () => {
      expect(bumpVersion('1.4.6', 'major')).toBe('2.0.0');
    });

    it('should bump major from zero', () => {
      expect(bumpVersion('0.1.5', 'major')).toBe('1.0.0');
    });

    it('should handle large major numbers', () => {
      expect(bumpVersion('99.4.6', 'major')).toBe('100.0.0');
    });
  });
});
