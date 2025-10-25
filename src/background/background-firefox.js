// Background script for Firefox (non-module version)
console.log('DefNotPromo background script loaded (Firefox)');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details.reason);
  
  if (details.reason === 'install') {
    console.log('First install - extension ready');
  }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message);
  
  // Handle different message types
  switch (message.type) {
    case 'OPEN_SIDE_PANEL':
      // Firefox uses sidebar, not sidePanel
      if (chrome.sidebarAction && chrome.sidebarAction.open) {
        chrome.sidebarAction.open();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Sidebar not supported' });
      }
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
 * Get content for auto-fill (using chrome.storage instead of IndexedDB directly)
 */
const handleGetContent = async (message, sendResponse) => {
  try {
    // For Firefox, we'll use a simpler approach without Dexie
    // Just return a placeholder for now
    sendResponse({ 
      success: true, 
      content: 'Check out this amazing product!',
      contentId: 'demo',
      variationId: 'demo-var'
    });
  } catch (error) {
    console.error('Failed to get content:', error);
    sendResponse({ success: false, error: error.message });
  }
};

/**
 * Track content usage
 */
const handleTrackUsage = async (message, sendResponse) => {
  try {
    console.log('Tracking usage:', message);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to track usage:', error);
    sendResponse({ success: false, error: error.message });
  }
};