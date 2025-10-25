import React, { useState, useEffect } from 'react';
import { db, exportAllData, importAllData } from '../../storage/db';

const SettingsView = () => {
  const [settings, setSettings] = useState({
    openaiKey: '',
    scraperKey: '',
    scraperService: 'scrapingbee',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadSettings();
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
              <label className="label">OpenAI API Key</label>
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
              <label className="label">Scraper API Key</label>
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