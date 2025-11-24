/**
 * API Cost Tracking Service
 * Tracks and calculates costs for API usage across different services
 */

import { db } from '../storage/db.js';
import { logInfo, logWarn, logError, logDebug } from './logger.js';

/**
 * Pricing information for different API services and models
 * Prices are per 1000 tokens (input/output)
 */
const API_PRICING = {
  openai: {
    'gpt-4o-mini': {
      input: 0.00015, // $0.150 per 1M tokens = $0.00015 per 1K tokens
      output: 0.0006, // $0.600 per 1M tokens = $0.0006 per 1K tokens
    },
    'gpt-4o': {
      input: 0.0025, // $2.50 per 1M tokens
      output: 0.01, // $10.00 per 1M tokens
    },
    'gpt-4-turbo': {
      input: 0.01, // $10.00 per 1M tokens
      output: 0.03, // $30.00 per 1M tokens
    },
    'gpt-3.5-turbo': {
      input: 0.0005, // $0.50 per 1M tokens
      output: 0.0015, // $1.50 per 1M tokens
    },
  },
  // Add other services here as needed (e.g., Anthropic, Google, etc.)
};

/**
 * Record API usage in the database
 * @param {Object} params - Usage parameters
 * @param {string} params.projectId - Project ID
 * @param {string} params.service - Service name (e.g., 'openai')
 * @param {string} params.model - Model name (e.g., 'gpt-4o-mini')
 * @param {number} params.inputTokens - Number of input tokens
 * @param {number} params.outputTokens - Number of output tokens
 * @param {number} params.cost - Calculated cost in USD
 * @returns {Promise<string>} Usage record ID
 */
export const recordApiUsage = async ({
  projectId,
  service,
  model,
  inputTokens,
  outputTokens,
  cost,
}) => {
  try {
    await logDebug('Recording API usage', { projectId, service, model, inputTokens, outputTokens, cost });
    
    if (!projectId) {
      await logWarn('No projectId provided, skipping API usage recording');
      return null;
    }
    
    const usageRecord = {
      id: `${service}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      service,
      model,
      inputTokens,
      outputTokens,
      cost,
      timestamp: new Date().toISOString(),
    };

    await db.apiUsage.add(usageRecord);
    await logInfo(`API usage recorded: $${cost.toFixed(4)}`, {
      recordId: usageRecord.id,
      projectId,
      service,
      model,
      inputTokens,
      outputTokens,
      cost,
    });
    
    // Broadcast cost update to all listeners (sidepanel, popup, etc.)
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'COST_UPDATED',
          data: {
            projectId,
            cost,
            timestamp: usageRecord.timestamp,
          },
        }).catch(() => {
          // Ignore errors if no listeners are active
        });
      }
    } catch (error) {
      // Silently fail if chrome.runtime is not available
    }
    
    return usageRecord.id;
  } catch (error) {
    await logError('Failed to record API usage', {
      error: error.message,
      stack: error.stack,
      projectId,
      service,
      model,
    });
    throw new Error(`Failed to record API usage: ${error.message}`);
  }
};

/**
 * Calculate cost for API usage
 * @param {Object} params - Usage parameters
 * @param {string} params.service - Service name
 * @param {string} params.model - Model name
 * @param {number} params.inputTokens - Number of input tokens
 * @param {number} params.outputTokens - Number of output tokens
 * @returns {number} Cost in USD
 */
export const calculateCost = ({ service, model, inputTokens, outputTokens }) => {
  const pricing = API_PRICING[service]?.[model];

  if (!pricing) {
    logWarn(`No pricing information for ${service}/${model}`, { service, model });
    return 0;
  }

  const inputCost = (inputTokens / 1000) * pricing.input;
  const outputCost = (outputTokens / 1000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return parseFloat(totalCost.toFixed(6)); // Round to 6 decimal places
};

/**
 * Get total cost for a specific project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Total cost in USD
 */
export const getProjectCost = async (projectId) => {
  try {
    await logDebug('Getting project cost', { projectId });
    const usageRecords = await db.apiUsage
      .where('projectId')
      .equals(projectId)
      .toArray();

    const totalCost = usageRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
    await logDebug('Project cost calculated', {
      projectId,
      recordCount: usageRecords.length,
      totalCost,
    });
    // Keep more precision for small costs - round to 4 decimal places
    return parseFloat(totalCost.toFixed(4));
  } catch (error) {
    await logError('Failed to get project cost', { error: error.message, projectId });
    return 0;
  }
};

/**
 * Get total cost across all projects
 * @returns {Promise<number>} Total cost in USD
 */
export const getTotalCost = async () => {
  try {
    const usageRecords = await db.apiUsage.toArray();
    const totalCost = usageRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
    // Keep more precision for small costs - round to 4 decimal places
    return parseFloat(totalCost.toFixed(4));
  } catch (error) {
    await logError('Failed to get total cost', { error: error.message });
    return 0;
  }
};

/**
 * Get cost breakdown by project
 * @returns {Promise<Object>} Object mapping project IDs to costs
 */
export const getCostByProject = async () => {
  try {
    const usageRecords = await db.apiUsage.toArray();
    const costByProject = {};

    for (const record of usageRecords) {
      if (!costByProject[record.projectId]) {
        costByProject[record.projectId] = 0;
      }
      costByProject[record.projectId] += record.cost || 0;
    }

    // Round all values - keep 4 decimal places for small costs
    for (const projectId in costByProject) {
      costByProject[projectId] = parseFloat(costByProject[projectId].toFixed(4));
    }

    return costByProject;
  } catch (error) {
    await logError('Failed to get cost by project', { error: error.message });
    return {};
  }
};

/**
 * Get usage statistics for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>} Usage statistics
 */
export const getProjectUsageStats = async (projectId) => {
  try {
    const usageRecords = await db.apiUsage
      .where('projectId')
      .equals(projectId)
      .toArray();

    const stats = {
      totalCalls: usageRecords.length,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byService: {},
      byModel: {},
    };

    for (const record of usageRecords) {
      stats.totalCost += record.cost || 0;
      stats.totalInputTokens += record.inputTokens || 0;
      stats.totalOutputTokens += record.outputTokens || 0;

      // Group by service
      if (!stats.byService[record.service]) {
        stats.byService[record.service] = { calls: 0, cost: 0 };
      }
      stats.byService[record.service].calls++;
      stats.byService[record.service].cost += record.cost || 0;

      // Group by model
      if (!stats.byModel[record.model]) {
        stats.byModel[record.model] = { calls: 0, cost: 0 };
      }
      stats.byModel[record.model].calls++;
      stats.byModel[record.model].cost += record.cost || 0;
    }

    // Round values
    stats.totalCost = parseFloat(stats.totalCost.toFixed(2));
    for (const service in stats.byService) {
      stats.byService[service].cost = parseFloat(stats.byService[service].cost.toFixed(2));
    }
    for (const model in stats.byModel) {
      stats.byModel[model].cost = parseFloat(stats.byModel[model].cost.toFixed(2));
    }

    return stats;
  } catch (error) {
    await logError('Failed to get project usage stats', { error: error.message, projectId });
    return {
      totalCalls: 0,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      byService: {},
      byModel: {},
    };
  }
};

/**
 * Clear usage records for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<number>} Number of records deleted
 */
export const clearProjectUsage = async (projectId) => {
  try {
    const count = await db.apiUsage.where('projectId').equals(projectId).delete();
    await logInfo(`Cleared ${count} usage records`, { projectId, count });
    return count;
  } catch (error) {
    await logError('Failed to clear project usage', { error: error.message, projectId });
    throw new Error(`Failed to clear project usage: ${error.message}`);
  }
};