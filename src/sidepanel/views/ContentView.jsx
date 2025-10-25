import React, { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import { generateVariations } from '../../services/openai';

const ContentView = ({ activeProject }) => {
  const [contentType, setContentType] = useState('post');
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (activeProject) {
      loadHistory();
    }
  }, [activeProject]);

  const loadHistory = async () => {
    try {
      const content = await db.generatedContent
        .where('projectId')
        .equals(activeProject.id)
        .reverse()
        .limit(10)
        .toArray();
      setHistory(content);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get OpenAI API key from settings
      const settings = await db.settings.get('main');
      if (!settings?.openaiKey) {
        throw new Error('Please configure your OpenAI API key in Settings');
      }

      // Generate variations
      const generated = await generateVariations({
        apiKey: settings.openaiKey,
        productName: activeProject.name,
        description: activeProject.description || '',
        type: contentType,
        targetAudience: activeProject.targetAudience || '',
        tone: activeProject.tone || 'professional',
        keyFeatures: activeProject.keyFeatures || [],
        count: 5,
      });

      // Create variation objects with IDs
      const variationObjects = generated.map((text, index) => ({
        id: `var-${Date.now()}-${index}`,
        text,
        createdAt: Date.now(),
      }));

      setVariations(variationObjects);

      // Save to database
      const contentId = `content-${Date.now()}`;
      await db.generatedContent.add({
        id: contentId,
        projectId: activeProject.id,
        type: contentType,
        variations: variationObjects,
        createdAt: Date.now(),
      });

      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditedText(variations[index].text);
  };

  const handleSaveEdit = () => {
    const updated = [...variations];
    updated[editingIndex] = {
      ...updated[editingIndex],
      text: editedText,
    };
    setVariations(updated);
    setEditingIndex(null);
    setEditedText('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditedText('');
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleUseVariation = async (variation) => {
    // This will be used when the user clicks "Use" on a variation
    // It will be tracked in analytics when actually posted
    await handleCopy(variation.text);
  };

  if (!activeProject) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Please select a project first</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Content Generation</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Generation Controls */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Generate New Content</h3>

        <div className="space-y-4">
          <div>
            <label className="label">Content Type</label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="post"
                  checked={contentType === 'post'}
                  onChange={(e) => setContentType(e.target.value)}
                  className="mr-2"
                />
                Post
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="comment"
                  checked={contentType === 'comment'}
                  onChange={(e) => setContentType(e.target.value)}
                  className="mr-2"
                />
                Comment
              </label>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Generating...' : 'Generate 5 Variations'}
          </button>
        </div>
      </div>

      {/* Generated Variations */}
      {variations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Generated Variations</h3>
          <div className="space-y-4">
            {variations.map((variation, index) => (
              <div key={variation.id} className="card">
                {editingIndex === index ? (
                  <div className="space-y-3">
                    <textarea
                      value={editedText}
                      onChange={(e) => setEditedText(e.target.value)}
                      className="input"
                      rows="4"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="btn btn-primary">
                        Save
                      </button>
                      <button onClick={handleCancelEdit} className="btn btn-secondary">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-900 mb-3 whitespace-pre-wrap">{variation.text}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUseVariation(variation)}
                        className="btn btn-primary text-sm"
                      >
                        Copy & Use
                      </button>
                      <button
                        onClick={() => handleEdit(index)}
                        className="btn btn-secondary text-sm"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content History */}
      {history.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Recent History</h3>
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="card bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {item.type === 'post' ? '📝 Post' : '💬 Comment'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {item.variations.length} variations generated
                </p>
                <button
                  onClick={() => setVariations(item.variations)}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  View Variations →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {variations.length === 0 && history.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg
              className="mx-auto h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No content yet</h3>
          <p className="text-gray-600 mb-4">
            Generate your first promotional content variations
          </p>
        </div>
      )}
    </div>
  );
};

export default ContentView;