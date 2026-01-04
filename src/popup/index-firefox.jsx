import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';

const Popup = () => {
  const openSidePanel = async () => {
    try {
      // Firefox: Use native sidebar API
      if (typeof browser !== 'undefined' && browser.sidebarAction && browser.sidebarAction.open) {
        await browser.sidebarAction.open();
        window.close();
      } else if (chrome.sidebarAction && chrome.sidebarAction.open) {
        await chrome.sidebarAction.open();
        window.close();
      } else {
        // Fallback: open in new tab
        chrome.tabs.create({
          url: chrome.runtime.getURL('src/sidepanel/index.html')
        });
        window.close();
      }
    } catch (error) {
      console.error('Failed to open side panel:', error);
      // Fallback on error
      chrome.tabs.create({
        url: chrome.runtime.getURL('src/sidepanel/index.html')
      });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-lg font-bold mb-4">DefPromo</h1>
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
