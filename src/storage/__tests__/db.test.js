import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Set up fake IndexedDB before importing db
global.indexedDB = new IDBFactory();

import { db, initializeDatabase, clearDatabase } from '../db.js';

describe('Database', () => {
  beforeEach(async () => {
    await initializeDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('Database Initialization', () => {
    it('should initialize database with correct tables', async () => {
      expect(db.settings).toBeDefined();
      expect(db.projects).toBeDefined();
      expect(db.generatedContent).toBeDefined();
      expect(db.analytics).toBeDefined();
    });

    it('should have correct version', () => {
      expect(db.verno).toBe(2);
    });
  });

  describe('Settings Table', () => {
    it('should store and retrieve settings', async () => {
      const settings = {
        id: 'main',
        openaiKey: 'test-key',
        scraperKey: 'scraper-key',
        scraperService: 'scrapingbee',
        theme: 'light',
      };

      await db.settings.put(settings);
      const retrieved = await db.settings.get('main');

      expect(retrieved).toEqual(settings);
    });

    it('should update existing settings', async () => {
      await db.settings.put({
        id: 'main',
        openaiKey: 'old-key',
        theme: 'light',
      });

      await db.settings.put({
        id: 'main',
        openaiKey: 'new-key',
        theme: 'dark',
      });

      const retrieved = await db.settings.get('main');
      expect(retrieved.openaiKey).toBe('new-key');
      expect(retrieved.theme).toBe('dark');
    });
  });

  describe('Projects Table', () => {
    it('should create a new project', async () => {
      const project = {
        id: 'proj-1',
        name: 'Test Project',
        url: 'https://example.com',
        description: 'A test project',
        targetAudience: 'Developers',
        keyFeatures: ['Feature 1', 'Feature 2'],
        tone: 'professional',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.projects.add(project);
      const retrieved = await db.projects.get('proj-1');

      expect(retrieved).toEqual(project);
    });

    it('should list all projects', async () => {
      const projects = [
        {
          id: 'proj-1',
          name: 'Project 1',
          url: 'https://example1.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        {
          id: 'proj-2',
          name: 'Project 2',
          url: 'https://example2.com',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      await db.projects.bulkAdd(projects);
      const allProjects = await db.projects.toArray();

      expect(allProjects).toHaveLength(2);
    });

    it('should delete a project', async () => {
      await db.projects.add({
        id: 'proj-1',
        name: 'Test',
        url: 'https://example.com',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await db.projects.delete('proj-1');
      const retrieved = await db.projects.get('proj-1');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('Generated Content Table', () => {
    it('should store generated content with variations', async () => {
      const content = {
        id: 'content-1',
        projectId: 'proj-1',
        type: 'post',
        variations: [
          { id: 'var-1', text: 'Variation 1', createdAt: Date.now() },
          { id: 'var-2', text: 'Variation 2', createdAt: Date.now() },
        ],
        createdAt: Date.now(),
      };

      await db.generatedContent.add(content);
      const retrieved = await db.generatedContent.get('content-1');

      expect(retrieved).toEqual(content);
      expect(retrieved.variations).toHaveLength(2);
    });

    it('should query content by project', async () => {
      await db.generatedContent.bulkAdd([
        {
          id: 'content-1',
          projectId: 'proj-1',
          type: 'post',
          variations: [],
          createdAt: Date.now(),
        },
        {
          id: 'content-2',
          projectId: 'proj-1',
          type: 'comment',
          variations: [],
          createdAt: Date.now(),
        },
        {
          id: 'content-3',
          projectId: 'proj-2',
          type: 'post',
          variations: [],
          createdAt: Date.now(),
        },
      ]);

      const proj1Content = await db.generatedContent
        .where('projectId')
        .equals('proj-1')
        .toArray();

      expect(proj1Content).toHaveLength(2);
    });
  });

  describe('Analytics Table', () => {
    it('should store analytics data', async () => {
      const analytics = {
        id: 'analytics-1',
        projectId: 'proj-1',
        contentId: 'content-1',
        variationId: 'var-1',
        platform: 'twitter',
        type: 'post',
        submittedAt: Date.now(),
        engagement: {
          likes: 10,
          comments: 5,
          shares: 2,
          updatedAt: Date.now(),
        },
      };

      await db.analytics.add(analytics);
      const retrieved = await db.analytics.get('analytics-1');

      expect(retrieved).toEqual(analytics);
    });

    it('should query analytics by project', async () => {
      const now = Date.now();
      await db.analytics.bulkAdd([
        {
          id: 'a-1',
          projectId: 'proj-1',
          contentId: 'c-1',
          variationId: 'v-1',
          platform: 'twitter',
          type: 'post',
          submittedAt: now,
          engagement: { likes: 10, comments: 5, shares: 2, updatedAt: now },
        },
        {
          id: 'a-2',
          projectId: 'proj-1',
          contentId: 'c-2',
          variationId: 'v-2',
          platform: 'linkedin',
          type: 'post',
          submittedAt: now,
          engagement: { likes: 20, comments: 10, shares: 5, updatedAt: now },
        },
      ]);

      const proj1Analytics = await db.analytics
        .where('projectId')
        .equals('proj-1')
        .toArray();

      expect(proj1Analytics).toHaveLength(2);
    });

    it('should query analytics by platform', async () => {
      const now = Date.now();
      await db.analytics.bulkAdd([
        {
          id: 'a-1',
          projectId: 'proj-1',
          contentId: 'c-1',
          variationId: 'v-1',
          platform: 'twitter',
          type: 'post',
          submittedAt: now,
          engagement: { likes: 10, comments: 5, shares: 2, updatedAt: now },
        },
        {
          id: 'a-2',
          projectId: 'proj-1',
          contentId: 'c-2',
          variationId: 'v-2',
          platform: 'twitter',
          type: 'comment',
          submittedAt: now,
          engagement: { likes: 5, comments: 2, shares: 1, updatedAt: now },
        },
      ]);

      const twitterAnalytics = await db.analytics
        .where('platform')
        .equals('twitter')
        .toArray();

      expect(twitterAnalytics).toHaveLength(2);
    });
  });
});