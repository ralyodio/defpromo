import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Setup fake-indexeddb before any other imports
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';

// Ensure indexedDB is available globally
if (typeof global.indexedDB === 'undefined') {
  global.indexedDB = new IDBFactory();
}

// Mock chrome API for testing
global.chrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
    getURL: vi.fn((path) => `chrome-extension://mock-id/${path}`),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
    },
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn(),
  },
  sidePanel: {
    open: vi.fn(),
    setOptions: vi.fn(),
  },
};

// Mock IndexedDB
global.indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};