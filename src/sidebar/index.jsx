import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../sidepanel/App.jsx';
import '../styles/global.css';

// Mount React app
const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);