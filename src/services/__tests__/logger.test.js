/**
 * Tests for Logger Service
 * Using Vitest framework
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  logger,
  logInfo,
  logWarn,
  logError,
  logDebug,
  getLogs,
  clearLogs,
  getLogsByLevel,
  getLogsByContext,
} from '../logger.js';
import { db, clearDatabase } from '../../storage/db.js';

describe('Logger Service', () => {
  // Mock console methods to prevent test output pollution
  let consoleLogSpy;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(async () => {
    await clearDatabase();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    await clearDatabase();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('logInfo', () => {
    it('should log info message to console and database', async () => {
      const logId = await logInfo('Test info message');

      expect(logId).toBeTruthy();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO] Test info message')
      );

      const log = await db.logs.get(logId);
      expect(log).toBeTruthy();
      expect(log.level).toBe('info');
      expect(log.message).toBe('Test info message');
      expect(log.timestamp).toBeTruthy();
    });

    it('should log info message with context', async () => {
      const logId = await logInfo('Test message', { userId: '123', action: 'create' });

      const log = await db.logs.get(logId);
      expect(log.context).toEqual({ userId: '123', action: 'create' });
    });

    it('should handle empty context', async () => {
      const logId = await logInfo('Test message', {});

      const log = await db.logs.get(logId);
      expect(log.context).toEqual({});
    });
  });

  describe('logWarn', () => {
    it('should log warning message to console and database', async () => {
      const logId = await logWarn('Test warning message');

      expect(logId).toBeTruthy();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[WARN] Test warning message')
      );

      const log = await db.logs.get(logId);
      expect(log).toBeTruthy();
      expect(log.level).toBe('warn');
      expect(log.message).toBe('Test warning message');
    });

    it('should log warning with context', async () => {
      const logId = await logWarn('Rate limit approaching', { remaining: 10 });

      const log = await db.logs.get(logId);
      expect(log.context).toEqual({ remaining: 10 });
    });
  });

  describe('logError', () => {
    it('should log error message to console and database', async () => {
      const logId = await logError('Test error message');

      expect(logId).toBeTruthy();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[ERROR] Test error message')
      );

      const log = await db.logs.get(logId);
      expect(log).toBeTruthy();
      expect(log.level).toBe('error');
      expect(log.message).toBe('Test error message');
    });

    it('should log error with Error object', async () => {
      const error = new Error('Something went wrong');
      const logId = await logError('Operation failed', { error: error.message, stack: error.stack });

      const log = await db.logs.get(logId);
      expect(log.context.error).toBe('Something went wrong');
      expect(log.context.stack).toBeTruthy();
    });
  });

  describe('logDebug', () => {
    it('should log debug message to console and database', async () => {
      const logId = await logDebug('Test debug message');

      expect(logId).toBeTruthy();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEBUG] Test debug message')
      );

      const log = await db.logs.get(logId);
      expect(log).toBeTruthy();
      expect(log.level).toBe('debug');
      expect(log.message).toBe('Test debug message');
    });

    it('should log debug with detailed context', async () => {
      const logId = await logDebug('API call details', {
        endpoint: '/api/generate',
        method: 'POST',
        tokens: 150,
      });

      const log = await db.logs.get(logId);
      expect(log.context).toEqual({
        endpoint: '/api/generate',
        method: 'POST',
        tokens: 150,
      });
    });
  });

  describe('logger.log', () => {
    it('should support generic log method with custom level', async () => {
      const logId = await logger.log('info', 'Generic log message');

      expect(logId).toBeTruthy();
      const log = await db.logs.get(logId);
      expect(log.level).toBe('info');
      expect(log.message).toBe('Generic log message');
    });

    it('should handle all log levels', async () => {
      const levels = ['info', 'warn', 'error', 'debug'];

      for (const level of levels) {
        const logId = await logger.log(level, `Test ${level} message`);
        const log = await db.logs.get(logId);
        expect(log.level).toBe(level);
      }
    });
  });

  describe('getLogs', () => {
    it('should return empty array when no logs exist', async () => {
      const logs = await getLogs();
      expect(logs).toEqual([]);
    });

    it('should return logs in reverse chronological order', async () => {
      await logInfo('First message');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await logInfo('Second message');
      await new Promise((resolve) => setTimeout(resolve, 10));
      await logInfo('Third message');

      const logs = await getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe('Third message');
      expect(logs[1].message).toBe('Second message');
      expect(logs[2].message).toBe('First message');
    });

    it('should limit logs to specified count', async () => {
      for (let i = 0; i < 10; i++) {
        await logInfo(`Message ${i}`);
      }

      const logs = await getLogs(5);
      expect(logs).toHaveLength(5);
    });

    it('should default to 100 logs limit', async () => {
      for (let i = 0; i < 150; i++) {
        await logInfo(`Message ${i}`);
      }

      const logs = await getLogs();
      expect(logs).toHaveLength(100);
    });
  });

  describe('getLogsByLevel', () => {
    it('should return only logs of specified level', async () => {
      await logInfo('Info message 1');
      await logWarn('Warning message');
      await logInfo('Info message 2');
      await logError('Error message');

      const infoLogs = await getLogsByLevel('info');
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs.every((log) => log.level === 'info')).toBe(true);

      const warnLogs = await getLogsByLevel('warn');
      expect(warnLogs).toHaveLength(1);
      expect(warnLogs[0].level).toBe('warn');
    });

    it('should return empty array for level with no logs', async () => {
      await logInfo('Info message');

      const debugLogs = await getLogsByLevel('debug');
      expect(debugLogs).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await logInfo(`Info message ${i}`);
      }

      const logs = await getLogsByLevel('info', 5);
      expect(logs).toHaveLength(5);
    });
  });

  describe('getLogsByContext', () => {
    it('should return logs matching context key', async () => {
      await logInfo('User action', { userId: '123' });
      await logInfo('System action', { system: 'auth' });
      await logInfo('Another user action', { userId: '456' });

      const userLogs = await getLogsByContext('userId');
      expect(userLogs).toHaveLength(2);
      expect(userLogs.every((log) => log.context?.userId)).toBe(true);
    });

    it('should return empty array when no logs match context', async () => {
      await logInfo('Message without context');

      const logs = await getLogsByContext('userId');
      expect(logs).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await logInfo(`Message ${i}`, { projectId: 'test' });
      }

      const logs = await getLogsByContext('projectId', 5);
      expect(logs).toHaveLength(5);
    });
  });

  describe('clearLogs', () => {
    it('should delete all logs from database', async () => {
      await logInfo('Message 1');
      await logWarn('Message 2');
      await logError('Message 3');

      const count = await clearLogs();
      expect(count).toBe(3);

      const logs = await getLogs();
      expect(logs).toEqual([]);
    });

    it('should return 0 when no logs exist', async () => {
      const count = await clearLogs();
      expect(count).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Close the database to simulate an error
      await db.close();

      // Should not throw, but return null
      const logId = await logInfo('Test message').catch(() => null);
      expect(logId).toBeNull();

      // Reopen database for cleanup
      await db.open();
    });

    it('should handle invalid log levels', async () => {
      const logId = await logger.log('invalid', 'Test message');
      
      // Should still create log with the provided level
      expect(logId).toBeTruthy();
      const log = await db.logs.get(logId);
      expect(log.level).toBe('invalid');
    });
  });

  describe('Timestamp Handling', () => {
    it('should create logs with ISO 8601 timestamps', async () => {
      const logId = await logInfo('Test message');
      const log = await db.logs.get(logId);

      expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should create logs with sequential timestamps', async () => {
      const id1 = await logInfo('First');
      await new Promise((resolve) => setTimeout(resolve, 10));
      const id2 = await logInfo('Second');

      const log1 = await db.logs.get(id1);
      const log2 = await db.logs.get(id2);

      expect(new Date(log2.timestamp).getTime()).toBeGreaterThan(
        new Date(log1.timestamp).getTime()
      );
    });
  });

  describe('Context Serialization', () => {
    it('should handle complex context objects', async () => {
      const complexContext = {
        user: { id: '123', name: 'Test User' },
        metadata: { tags: ['tag1', 'tag2'], count: 5 },
        nested: { deep: { value: 'test' } },
      };

      const logId = await logInfo('Complex context', complexContext);
      const log = await db.logs.get(logId);

      expect(log.context).toEqual(complexContext);
    });

    it('should handle null and undefined context values', async () => {
      const logId = await logInfo('Test', { value: null, other: undefined });
      const log = await db.logs.get(logId);

      expect(log.context.value).toBeNull();
      expect(log.context.other).toBeUndefined();
    });
  });
});