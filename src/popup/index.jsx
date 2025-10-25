import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';

const Popup = () => {
  const isSafari = () => {
    return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  };

  const openSidePanel = async () => {
    try {
      if (isSafari()) {
        // Safari: Open sidepanel in new tab
        chrome.tabs.create({
          url: chrome.runtime.getURL('src/sidepanel/index.html')
        });
        window.close();
      } else if (chrome.sidePanel && chrome.sidePanel.open) {
        // Chrome/Edge with sidePanel API
        const currentWindow = await chrome.windows.getCurrent();
        await chrome.sidePanel.open({ windowId: currentWindow.id });
        window.close();
      } else {
        // Firefox or browsers without sidePanel - send message to background
        chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }, (response) => {
          if (response?.success) {
            window.close();
          }
        });
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
      // Don't show alert, just log - the side panel might have opened anyway
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-4">DefNotPromo</h1>
      <button onClick={openSidePanel} className="btn btn-primary w-full">
        Open Side Panel
      </button>
      <p className="text-xs text-gray-500 mt-4 text-center">
        Click to open the full interface
      </p>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);