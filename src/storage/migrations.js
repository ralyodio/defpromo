/**
 * Database Migration Utilities
 * Handles schema updates and data migrations for DefNotPromo
 */

import { db } from './db.js';

/**
 * Current database version
 */
export const CURRENT_VERSION = 1;

/**
 * Migration functions for each version
 * Each function should handle upgrading from previous version
 */
const migrations = {
  1: async () => {
    // Initial version - no migration needed
    console.log('Database initialized at version 1');
  },
  
  // Example for future version 2:
  // 2: async () => {
  //   // Add new fields to existing records
  //   const projects = await db.projects.toArray();
  //   for (const project of projects) {
  //     if (!project.hasOwnProperty('newField')) {
  //       project.newField = 'default value';
  //       await db.projects.put(project);
  //     }
  //   }
  // },
};

/**
 * Run all necessary migrations
 * @returns {Promise<void>}
 */
export const runMigrations = async () => {
  try {
    // Get current version from settings
    const settings = await db.settings.get('main');
    const currentDbVersion = settings?.dbVersion || 0;

    console.log(`Current DB version: ${currentDbVersion}, Target version: ${CURRENT_VERSION}`);

    // Run migrations in order
    for (let version = currentDbVersion + 1; version <= CURRENT_VERSION; version++) {
      if (migrations[version]) {
        console.log(`Running migration to version ${version}...`);
        await migrations[version]();
        
        // Update version in settings
        await db.settings.put({
          id: 'main',
          ...settings,
          dbVersion: version,
        });
        
        console.log(`Migration to version ${version} complete`);
      }
    }

    console.log('All migrations complete');
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error(`Database migration failed: ${error.message}`);
  }
};

/**
 * Check if migrations are needed
 * @returns {Promise<boolean>}
 */
export const needsMigration = async () => {
  try {
    const settings = await db.settings.get('main');
    const currentDbVersion = settings?.dbVersion || 0;
    return currentDbVersion < CURRENT_VERSION;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
};

/**
 * Reset database to initial state (for testing/debugging)
 * @returns {Promise<void>}
 */
export const resetDatabase = async () => {
  try {
    await db.delete();
    console.log('Database reset complete');
  } catch (error) {
    console.error('Failed to reset database:', error);
    throw error;
  }
};