import React from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';

const Popup = () => {
  const openSidePanel = () => {
    chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
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