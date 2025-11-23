import React, { useState, useEffect } from 'react';
import { db, exportAllData, importAllData } from '../../storage/db';
import { getLogs, clearLogs } from '../../services/logger';

const SettingsView = () => {
  const [settings, setSettings] = useState({
    openaiKey: '',
    scraperKey: '',
    scraperService: 'scrapingbee',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadLogs();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await db.settings.get('main');
      if (saved) {
        setSettings({
          openaiKey: saved.openaiKey || '',
          scraperKey: saved.scraperKey || '',
          scraperService: saved.scraperService || 'scrapingbee',
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      await db.settings.put({
        id: 'main',
        ...settings,
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to save settings: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defpromo-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: 'Data exported successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: `Export failed: ${error.message}` });
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAllData(data, false);
      setMessage({ type: 'success', text: 'Data imported successfully!' });
      window.location.reload();
    } catch (error) {
      setMessage({ type: 'error', text: `Import failed: ${error.message}` });
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const recentLogs = await getLogs(100);
      setLogs(recentLogs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleCopyLogs = async () => {
    try {
      const logsText = logs
        .map((log) => {
          const contextStr = log.context && Object.keys(log.context).length > 0
            ? ` ${JSON.stringify(log.context)}`
            : '';
          return `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}${contextStr}`;
        })
        .join('\n');
      
      await navigator.clipboard.writeText(logsText);
      setMessage({ type: 'success', text: 'Logs copied to clipboard!' });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to copy logs: ${error.message}` });
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }

    try {
      const count = await clearLogs();
      setLogs([]);
      setMessage({ type: 'success', text: `Cleared ${count} log entries` });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to clear logs: ${error.message}` });
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50';
      case 'debug':
        return 'text-purple-600 bg-purple-50';
      case 'info':
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">API Keys</h3>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">OpenAI API Key</label>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <span>Create API Key</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <input
                type="password"
                value={settings.openaiKey}
                onChange={(e) => setSettings({ ...settings, openaiKey: e.target.value })}
                className="input"
                placeholder="sk-..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Required for AI content generation
              </p>
            </div>

            <div>
              <label className="label">Web Scraper Service</label>
              <select
                value={settings.scraperService}
                onChange={(e) => setSettings({ ...settings, scraperService: e.target.value })}
                className="input"
              >
                <option value="scrapingbee">ScrapingBee</option>
                <option value="scraperapi">ScraperAPI</option>
                <option value="browserless">Browserless</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Scraper API Key</label>
                <a
                  href={
                    settings.scraperService === 'scrapingbee'
                      ? 'https://www.scrapingbee.com/account/api'
                      : settings.scraperService === 'scraperapi'
                      ? 'https://www.scraperapi.com/dashboard'
                      : 'https://www.browserless.io/account'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <span>Get API Key</span>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <input
                type="password"
                value={settings.scraperKey}
                onChange={(e) => setSettings({ ...settings, scraperKey: e.target.value })}
                className="input"
                placeholder="Your scraper API key"
              />
              <p className="text-xs text-gray-500 mt-1">
                Required for automatic product information extraction
              </p>
            </div>
          </div>

          <div className="mt-6">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>

      <div className="card mt-6">
        <h3 className="text-lg font-semibold mb-4">Data Management</h3>
        <div className="space-y-4">
          <div>
            <button onClick={handleExport} className="btn btn-secondary w-full">
              Export All Data
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Download all your projects, content, and analytics as JSON
            </p>
          </div>

          <div>
            <label className="btn btn-secondary w-full cursor-pointer">
              Import Data
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Restore data from a previous export (will replace all current data)
            </p>
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Logs</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLogs}
              disabled={logs.length === 0}
              className="btn btn-secondary text-xs py-1 px-3"
              title="Copy all logs to clipboard"
            >
              Copy Logs
            </button>
            <button
              onClick={handleClearLogs}
              disabled={logs.length === 0}
              className="btn btn-secondary text-xs py-1 px-3"
              title="Clear all logs"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {logsLoading ? (
          <div className="text-center py-8 text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No logs available</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${getLevelColor(log.level)}`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 break-words">{log.message}</p>
                    {log.context && Object.keys(log.context).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          View context
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 mt-4">
          Showing last {logs.length} log entries. Logs help debug issues with cost tracking and other features.
        </p>
      </div>

      <div className="card mt-6 bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">About</h3>
        <p className="text-sm text-gray-600">
          DefPromo v1.0.0
        </p>
        <p className="text-xs text-gray-500 mt-2">
          AI-powered social media promotion assistant
        </p>
      </div>
    </div>
  );
};

export default SettingsView;