// Background service worker for DefPromo extension
import { db } from '../storage/db.js';

console.log('DefPromo background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    // Set initial sidebar state
    chrome.storage.local.set({
      'defpromo-sidebar-state': false,
      'defpromo-sidebar-width': 400,
    });
  }
});

// Handle extension icon clicks
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Send message to content script to toggle sidebar
    await chrome.tabs.sendMessage(tab.id, {
      type: 'TOGGLE_SIDEBAR',
    });
  } catch (error) {
    console.error('Failed to toggle sidebar:', error);
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  // Handle different message types
  switch (message.type) {
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