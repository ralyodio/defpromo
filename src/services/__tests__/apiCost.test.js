/**
 * Tests for API Cost Tracking Service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  recordApiUsage,
  calculateCost,
  getProjectCost,
  getTotalCost,
  getCostByProject,
  getProjectUsageStats,
  clearProjectUsage,
} from '../apiCost.js';
import { db, clearDatabase } from '../../storage/db.js';

describe('API Cost Service', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('calculateCost', () => {
    it('should calculate cost for gpt-4o-mini correctly', () => {
      const cost = calculateCost({
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 1000,
        outputTokens: 500,
      });

      // Input: 1000 tokens * $0.00015 per 1K = $0.15
      // Output: 500 tokens * $0.0006 per 1K = $0.30
      // Total: $0.45
      expect(cost).toBe(0.00045);
    });

    it('should calculate cost for gpt-4o correctly', () => {
      const cost = calculateCost({
        service: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 1000,
      });

      // Input: 1000 tokens * $0.0025 per 1K = $2.50
      // Output: 1000 tokens * $0.01 per 1K = $10.00
      // Total: $12.50
      expect(cost).toBe(0.0125);
    });

    it('should return 0 for unknown service/model', () => {
      const cost = calculateCost({
        service: 'unknown',
        model: 'unknown',
        inputTokens: 1000,
        outputTokens: 1000,
      });

      expect(cost).toBe(0);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost({
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 0,
        outputTokens: 0,
      });

      expect(cost).toBe(0);
    });
  });

  describe('recordApiUsage', () => {
    it('should record API usage successfully', async () => {
      const usageId = await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.00015,
      });

      expect(usageId).toBeTruthy();

      const record = await db.apiUsage.get(usageId);
      expect(record).toBeTruthy();
      expect(record.projectId).toBe('project-1');
      expect(record.service).toBe('openai');
      expect(record.model).toBe('gpt-4o-mini');
      expect(record.inputTokens).toBe(100);
      expect(record.outputTokens).toBe(50);
      expect(record.cost).toBe(0.00015);
    });

    it('should generate unique IDs for each record', async () => {
      const id1 = await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.00015,
      });

      const id2 = await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.00015,
      });

      expect(id1).not.toBe(id2);
    });
  });

  describe('getProjectCost', () => {
    it('should return 0 for project with no usage', async () => {
      const cost = await getProjectCost('project-1');
      expect(cost).toBe(0);
    });

    it('should calculate total cost for a project', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 200,
        outputTokens: 100,
        cost: 0.75,
      });

      const cost = await getProjectCost('project-1');
      expect(cost).toBe(1.25);
    });

    it('should only include costs for the specified project', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-2',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 200,
        outputTokens: 100,
        cost: 0.75,
      });

      const cost = await getProjectCost('project-1');
      expect(cost).toBe(0.5);
    });
  });

  describe('getTotalCost', () => {
    it('should return 0 when no usage records exist', async () => {
      const cost = await getTotalCost();
      expect(cost).toBe(0);
    });

    it('should calculate total cost across all projects', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-2',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 200,
        outputTokens: 100,
        cost: 0.75,
      });

      const cost = await getTotalCost();
      expect(cost).toBe(1.25);
    });
  });

  describe('getCostByProject', () => {
    it('should return empty object when no usage records exist', async () => {
      const costs = await getCostByProject();
      expect(costs).toEqual({});
    });

    it('should return costs grouped by project', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.3,
      });

      await recordApiUsage({
        projectId: 'project-2',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 200,
        outputTokens: 100,
        cost: 0.75,
      });

      const costs = await getCostByProject();
      expect(costs).toEqual({
        'project-1': 0.8,
        'project-2': 0.75,
      });
    });
  });

  describe('getProjectUsageStats', () => {
    it('should return empty stats for project with no usage', async () => {
      const stats = await getProjectUsageStats('project-1');
      
      expect(stats.totalCalls).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.byService).toEqual({});
      expect(stats.byModel).toEqual({});
    });

    it('should calculate comprehensive usage statistics', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o',
        inputTokens: 200,
        outputTokens: 100,
        cost: 0.75,
      });

      const stats = await getProjectUsageStats('project-1');
      
      expect(stats.totalCalls).toBe(2);
      expect(stats.totalCost).toBe(1.25);
      expect(stats.totalInputTokens).toBe(300);
      expect(stats.totalOutputTokens).toBe(150);
      expect(stats.byService.openai.calls).toBe(2);
      expect(stats.byService.openai.cost).toBe(1.25);
      expect(stats.byModel['gpt-4o-mini'].calls).toBe(1);
      expect(stats.byModel['gpt-4o-mini'].cost).toBe(0.5);
      expect(stats.byModel['gpt-4o'].calls).toBe(1);
      expect(stats.byModel['gpt-4o'].cost).toBe(0.75);
    });
  });

  describe('clearProjectUsage', () => {
    it('should clear all usage records for a project', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.3,
      });

      const count = await clearProjectUsage('project-1');
      expect(count).toBe(2);

      const cost = await getProjectCost('project-1');
      expect(cost).toBe(0);
    });

    it('should only clear records for the specified project', async () => {
      await recordApiUsage({
        projectId: 'project-1',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 100,
        outputTokens: 50,
        cost: 0.5,
      });

      await recordApiUsage({
        projectId: 'project-2',
        service: 'openai',
        model: 'gpt-4o-mini',
        inputTokens: 200,
        outputTokens: 100,
        cost: 0.75,
      });

      await clearProjectUsage('project-1');

      const cost1 = await getProjectCost('project-1');
      const cost2 = await getProjectCost('project-2');
      
      expect(cost1).toBe(0);
      expect(cost2).toBe(0.75);
    });
  });
});