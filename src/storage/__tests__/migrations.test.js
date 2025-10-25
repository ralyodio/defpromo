import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

global.indexedDB = new IDBFactory();

import { db, initializeDatabase, clearDatabase } from '../db.js';
import { runMigrations, needsMigration, CURRENT_VERSION } from '../migrations.js';

describe('Database Migrations', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('runMigrations', () => {
    it('should run migrations successfully', async () => {
      await runMigrations();
      
      const settings = await db.settings.get('main');
      expect(settings?.dbVersion).toBe(CURRENT_VERSION);
    });

    it('should not run migrations if already at current version', async () => {
      await db.settings.put({
        id: 'main',
        dbVersion: CURRENT_VERSION,
      });

      await runMigrations();
      
      const settings = await db.settings.get('main');
      expect(settings.dbVersion).toBe(CURRENT_VERSION);
    });
  });

  describe('needsMigration', () => {
    it('should return true if migration needed', async () => {
      await db.settings.put({
        id: 'main',
        dbVersion: 0,
      });

      const needs = await needsMigration();
      expect(needs).toBe(true);
    });

    it('should return false if at current version', async () => {
      await db.settings.put({
        id: 'main',
        dbVersion: CURRENT_VERSION,
      });

      const needs = await needsMigration();
      expect(needs).toBe(false);
    });
  });
});