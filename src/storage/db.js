import Dexie from 'dexie';

/**
 * DefPromo Database
 * IndexedDB database using Dexie.js for storing projects, content, and analytics
 */
export const db = new Dexie('DefPromoDB');

// Define database schema
db.version(1).stores({
  settings: 'id',
  projects: 'id, name, createdAt, updatedAt',
  generatedContent: 'id, projectId, type, createdAt',
  analytics: 'id, projectId, contentId, platform, submittedAt',
});

/**
 * Initialize the database
 * @returns {Promise<void>}
 */
export const initializeDatabase = async () => {
  try {
    await db.open();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
};

/**
 * Clear all data from the database (useful for testing)
 * @returns {Promise<void>}
 */
export const clearDatabase = async () => {
  try {
    await db.settings.clear();
    await db.projects.clear();
    await db.generatedContent.clear();
    await db.analytics.clear();
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Failed to clear database:', error);
    throw new Error(`Database clear failed: ${error.message}`);
  }
};

/**
 * Delete the entire database (useful for testing or reset)
 * @returns {Promise<void>}
 */
export const deleteDatabase = async () => {
  try {
    await db.delete();
    console.log('Database deleted successfully');
  } catch (error) {
    console.error('Failed to delete database:', error);
    throw new Error(`Database deletion failed: ${error.message}`);
  }
};

/**
 * Export all data from the database
 * @returns {Promise<Object>} All database data as JSON
 */
export const exportAllData = async () => {
  try {
    const [settings, projects, generatedContent, analytics] = await Promise.all([
      db.settings.toArray(),
      db.projects.toArray(),
      db.generatedContent.toArray(),
      db.analytics.toArray(),
    ]);

    return {
      version: db.verno,
      exportedAt: new Date().toISOString(),
      data: {
        settings,
        projects,
        generatedContent,
        analytics,
      },
    };
  } catch (error) {
    console.error('Failed to export data:', error);
    throw new Error(`Data export failed: ${error.message}`);
  }
};

/**
 * Import data into the database
 * @param {Object} data - Data to import
 * @param {boolean} merge - Whether to merge with existing data or replace
 * @returns {Promise<Object>} Import statistics
 */
export const importAllData = async (data, merge = false) => {
  try {
    if (!data || !data.data) {
      throw new Error('Invalid import data format');
    }

    const stats = {
      settings: 0,
      projects: 0,
      generatedContent: 0,
      analytics: 0,
    };

    // If not merging, clear existing data first
    if (!merge) {
      await clearDatabase();
    }

    // Import settings
    if (data.data.settings?.length > 0) {
      if (merge) {
        for (const setting of data.data.settings) {
          await db.settings.put(setting);
          stats.settings++;
        }
      } else {
        await db.settings.bulkAdd(data.data.settings);
        stats.settings = data.data.settings.length;
      }
    }

    // Import projects
    if (data.data.projects?.length > 0) {
      if (merge) {
        for (const project of data.data.projects) {
          await db.projects.put(project);
          stats.projects++;
        }
      } else {
        await db.projects.bulkAdd(data.data.projects);
        stats.projects = data.data.projects.length;
      }
    }

    // Import generated content
    if (data.data.generatedContent?.length > 0) {
      if (merge) {
        for (const content of data.data.generatedContent) {
          await db.generatedContent.put(content);
          stats.generatedContent++;
        }
      } else {
        await db.generatedContent.bulkAdd(data.data.generatedContent);
        stats.generatedContent = data.data.generatedContent.length;
      }
    }

    // Import analytics
    if (data.data.analytics?.length > 0) {
      if (merge) {
        for (const analytic of data.data.analytics) {
          await db.analytics.put(analytic);
          stats.analytics++;
        }
      } else {
        await db.analytics.bulkAdd(data.data.analytics);
        stats.analytics = data.data.analytics.length;
      }
    }

    console.log('Data imported successfully:', stats);
    return stats;
  } catch (error) {
    console.error('Failed to import data:', error);
    throw new Error(`Data import failed: ${error.message}`);
  }
};

// Don't auto-initialize in test environment
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  // Initialize database on module load in production
  initializeDatabase().catch((error) => {
    console.error('Failed to initialize database on load:', error);
  });
}

export default db;