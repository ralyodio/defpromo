/**
 * Logger Service
 * Provides logging functionality that writes to both console and database
 * Supports different log levels: info, warn, error, debug
 */

import { db } from '../storage/db.js';

/**
 * Log levels
 */
export const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug',
};

/**
 * Format timestamp for console output
 * @param {Date} date - Date object
 * @returns {string} Formatted timestamp
 */
const formatTimestamp = (date) => {
  return date.toISOString();
};

/**
 * Format log message for console output
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {string} Formatted log message
 */
const formatLogMessage = (level, message, context) => {
  const timestamp = formatTimestamp(new Date());
  const levelStr = `[${level.toUpperCase()}]`;
  const contextStr = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
  return `${timestamp} ${levelStr} ${message}${contextStr}`;
};

/**
 * Write log to console based on level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 */
const writeToConsole = (level, message, context) => {
  const formattedMessage = formatLogMessage(level, message, context);

  switch (level) {
    case LOG_LEVELS.ERROR:
      console.error(formattedMessage);
      break;
    case LOG_LEVELS.WARN:
      console.warn(formattedMessage);
      break;
    case LOG_LEVELS.INFO:
    case LOG_LEVELS.DEBUG:
    default:
      console.log(formattedMessage);
      break;
  }
};

/**
 * Write log to database
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {Promise<string>} Log ID
 */
const writeToDatabase = async (level, message, context = {}) => {
  try {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    await db.logs.add(logEntry);
    return logEntry.id;
  } catch (error) {
    console.error('Failed to write log to database:', error);
    throw error;
  }
};

/**
 * Core logging function
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {Promise<string>} Log ID
 */
const log = async (level, message, context = {}) => {
  try {
    // Write to console synchronously
    writeToConsole(level, message, context);

    // Write to database asynchronously
    const logId = await writeToDatabase(level, message, context);
    return logId;
  } catch (error) {
    console.error('Logging failed:', error);
    return null;
  }
};

/**
 * Log info message
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {Promise<string>} Log ID
 */
export const logInfo = async (message, context = {}) => {
  return log(LOG_LEVELS.INFO, message, context);
};

/**
 * Log warning message
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {Promise<string>} Log ID
 */
export const logWarn = async (message, context = {}) => {
  return log(LOG_LEVELS.WARN, message, context);
};

/**
 * Log error message
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {Promise<string>} Log ID
 */
export const logError = async (message, context = {}) => {
  return log(LOG_LEVELS.ERROR, message, context);
};

/**
 * Log debug message
 * @param {string} message - Log message
 * @param {Object} context - Optional context object
 * @returns {Promise<string>} Log ID
 */
export const logDebug = async (message, context = {}) => {
  return log(LOG_LEVELS.DEBUG, message, context);
};

/**
 * Get logs from database
 * @param {number} limit - Maximum number of logs to retrieve (default: 100)
 * @returns {Promise<Array>} Array of log entries in reverse chronological order
 */
export const getLogs = async (limit = 100) => {
  try {
    const logs = await db.logs
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();
    return logs;
  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    return [];
  }
};

/**
 * Get logs by level
 * @param {string} level - Log level to filter by
 * @param {number} limit - Maximum number of logs to retrieve (default: 100)
 * @returns {Promise<Array>} Array of log entries
 */
export const getLogsByLevel = async (level, limit = 100) => {
  try {
    const logs = await db.logs
      .where('level')
      .equals(level)
      .reverse()
      .limit(limit)
      .toArray();
    return logs;
  } catch (error) {
    console.error('Failed to retrieve logs by level:', error);
    return [];
  }
};

/**
 * Get logs by context key
 * @param {string} contextKey - Context key to filter by
 * @param {number} limit - Maximum number of logs to retrieve (default: 100)
 * @returns {Promise<Array>} Array of log entries
 */
export const getLogsByContext = async (contextKey, limit = 100) => {
  try {
    const logs = await db.logs
      .orderBy('timestamp')
      .reverse()
      .limit(limit)
      .toArray();

    // Filter logs that have the specified context key
    return logs.filter((log) => log.context && contextKey in log.context);
  } catch (error) {
    console.error('Failed to retrieve logs by context:', error);
    return [];
  }
};

/**
 * Clear all logs from database
 * @returns {Promise<number>} Number of logs deleted
 */
export const clearLogs = async () => {
  try {
    const count = await db.logs.count();
    await db.logs.clear();
    return count;
  } catch (error) {
    console.error('Failed to clear logs:', error);
    throw error;
  }
};

/**
 * Logger object with all logging methods
 */
export const logger = {
  log,
  info: logInfo,
  warn: logWarn,
  error: logError,
  debug: logDebug,
  getLogs,
  getLogsByLevel,
  getLogsByContext,
  clearLogs,
};

export default logger;