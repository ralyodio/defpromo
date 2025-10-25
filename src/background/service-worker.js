// Background service worker for DefNotPromo extension
import { db } from '../storage/db.js';

console.log('DefNotPromo background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Open side panel on first install
    chrome.sidePanel.setOptions({
      enabled: true,
    });
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  // Handle different message types
  switch (message.type) {
    case 'OPEN_SIDE_PANEL':
      handleOpenSidePanel(sender, sendResponse);
      break;
      
    case 'GET_CONTENT':
      handleGetContent(message, sendResponse);
      break;
      
    case 'TRACK_USAGE':
      handleTrackUsage(message, sendResponse);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async response
});

/**
 * Open the side panel
 */
const handleOpenSidePanel = async (sender, sendResponse) => {
  try {
    await chrome.sidePanel.open({ windowId: sender.tab.windowId });
    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to open side panel:', error);
    sendResponse({ success: false, error: error.message });
  }
};

/**
 * Get content for auto-fill
 */
const handleGetContent = async (message, sendResponse) => {
  try {
    // Get active project
    const settings = await db.settings.get('main');
    if (!settings?.activeProjectId) {
      sendResponse({ success: false, error: 'No active project' });
      return;
    }

    // Get most recent content for this project and type
    const content = await db.generatedContent
      .where('projectId')
      .equals(settings.activeProjectId)
      .and((item) => item.type === message.contentType)
      .reverse()
      .first();

    if (!content || !content.variations || content.variations.length === 0) {
      sendResponse({ success: false, error: 'No content available' });
      return;
    }

    // Return the first variation
    const variation = content.variations[0];
    sendResponse({
      success: true,
      content: variation.text,
      contentId: content.id,
      variationId: variation.id,
    });
  } catch (error) {
    console.error('Failed to get content:', error);
    sendResponse({ success: false, error: error.message });
  }
};

/**
 * Track content usage in analytics
 */
const handleTrackUsage = async (message, sendResponse) => {
  try {
    const settings = await db.settings.get('main');
    if (!settings?.activeProjectId) {
      sendResponse({ success: false, error: 'No active project' });
      return;
    }

    // Create analytics entry
    const analyticsId = `analytics-${Date.now()}`;
    await db.analytics.add({
      id: analyticsId,
      projectId: settings.activeProjectId,
      contentId: message.contentId,
      variationId: message.variationId,
      platform: message.platform,
      type: message.contentType,
      submittedAt: Date.now(),
      engagement: {
        likes: 0,
        comments: 0,
        shares: 0,
        updatedAt: Date.now(),
      },
    });

    sendResponse({ success: true, analyticsId });
  } catch (error) {
    console.error('Failed to track usage:', error);
    sendResponse({ success: false, error: error.message });
  }
};