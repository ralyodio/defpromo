import React, { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import { generateVariations } from '../../services/openai';

const ContentView = ({ activeProject }) => {
  const [contentType, setContentType] = useState('comment');
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [history, setHistory] = useState([]);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextTitle, setContextTitle] = useState('');
  const [contextContent, setContextContent] = useState('');

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

  const getPageContext = async () => {
    try {
      // Use browser API for Firefox compatibility
      const api = typeof browser !== 'undefined' ? browser : chrome;
      
      // Get current tab
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      
      console.log('Query result:', tabs);
      
      if (!tabs || tabs.length === 0) {
        throw new Error('No active tab found. Make sure you have a Reddit tab open.');
      }

      const tab = tabs[0];
      
      if (!tab?.id) {
        throw new Error('Tab has no ID');
      }

      // Check if we're on Reddit
      if (!tab.url?.includes('reddit.com')) {
        throw new Error(`Not on a Reddit page. Current URL: ${tab.url || 'unknown'}`);
      }

      console.log('Sending message to tab:', tab.id, tab.url);

      // Send message to content script to get page context
      const response = await api.tabs.sendMessage(tab.id, {
        type: 'GET_PAGE_CONTEXT',
      });

      console.log('Received response:', response);

      if (!response) {
        throw new Error('No response from content script. The page may need to be refreshed.');
      }

      if (response?.success && response?.context) {
        return response.context;
      }

      throw new Error('Content script returned invalid data. Try refreshing the page.');
    } catch (err) {
      console.error('Failed to get page context:', err);
      throw new Error(err.message || 'Failed to extract context');
    }
  };

  const handlePrepareGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get page context for comments
      if (contentType === 'comment') {
        try {
          const pageContext = await getPageContext();
          console.log('Got page context:', pageContext);
          setContextTitle(pageContext?.title || '');
          setContextContent(pageContext?.content || '');
          setShowContextEditor(true);
        } catch (contextErr) {
          console.error('Context extraction error:', contextErr);
          // Show editor anyway with empty fields so user can manually enter
          setContextTitle('');
          setContextContent('');
          setShowContextEditor(true);
          setError(`Could not auto-extract context: ${contextErr.message}. Please enter manually.`);
        }
      } else {
        // For posts, generate directly without context
        await handleGenerate(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (pageContext) => {
    setLoading(true);
    setError(null);

    try {
      // Get OpenAI API key from settings
      const settings = await db.settings.get('main');
      if (!settings?.openaiKey) {
        throw new Error('Please configure your OpenAI API key in Settings');
      }

      // Use provided context or null for posts
      const context = pageContext || (contentType === 'comment' ? { title: contextTitle, content: contextContent } : null);

      // Generate variations
      const generated = await generateVariations({
        apiKey: settings.openaiKey,
        productName: activeProject.name,
        description: activeProject.description || '',
        type: contentType,
        targetAudience: activeProject.targetAudience || '',
        tone: activeProject.tone || 'professional',
        keyFeatures: activeProject.keyFeatures || [],
        pageContext: context,
        count: 5,
      });

      // Create variation objects with IDs
      const variationObjects = generated.map((text, index) => ({
        id: `var-${Date.now()}-${index}`,
        text,
        createdAt: Date.now(),
      }));

      setVariations(variationObjects);
      setShowContextEditor(false);

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
    // Copy to clipboard
    await handleCopy(variation.text);
  };

  const handleFillForm = async (text) => {
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        setError('No active tab found');
        return;
      }

      // Execute script to fill the comment form
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (commentText) => {
          // Step 1: Try to find and click the Reddit comment trigger button
          const triggerButton = document.querySelector('faceplate-textarea-input[data-testid="trigger-button"]');
          if (triggerButton) {
            triggerButton.click();
            
            // Wait a bit for the form to render
            setTimeout(() => {
              // Step 2: Find the actual textarea in the rendered form
              const textarea = document.querySelector('shreddit-composer textarea[placeholder*="Share your thoughts" i]');
              if (textarea) {
                textarea.value = commentText;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                textarea.focus();
                return;
              }
            }, 300);
            return;
          }

          // Fallback: Try multiple selectors for different platforms
          const selectors = [
            'shreddit-composer textarea',
            'textarea[placeholder*="comment" i]',
            'textarea[placeholder*="reply" i]',
            'textarea[placeholder*="thoughts" i]',
            'textarea[name="comment"]',
            'textarea[aria-label*="comment" i]',
            '[contenteditable="true"]',
            'textarea',
          ];

          for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) { // Check if visible
              if (element.contentEditable === 'true') {
                element.textContent = commentText;
                element.innerHTML = commentText;
              } else {
                element.value = commentText;
              }
              
              // Trigger input event
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              // Focus the element
              element.focus();
              return true;
            }
          }
          return false;
        },
        args: [text],
      });
    } catch (err) {
      console.error('Failed to fill form:', err);
      setError('Failed to fill form. Please copy and paste manually.');
    }
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
            onClick={handlePrepareGenerate}
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? 'Loading...' : 'Generate 5 Variations'}
          </button>
        </div>
      </div>

      {/* Context Editor */}
      {showContextEditor && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Review Post Context</h3>
          <p className="text-sm text-gray-600 mb-4">
            Edit the post context below if needed, then click Generate to create comments.
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Post Title</label>
              <input
                type="text"
                value={contextTitle}
                onChange={(e) => setContextTitle(e.target.value)}
                className="input"
                placeholder="Post title"
              />
            </div>
            <div>
              <label className="label">Post Content</label>
              <textarea
                value={contextContent}
                onChange={(e) => setContextContent(e.target.value)}
                className="input"
                rows="6"
                placeholder="Post content"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleGenerate(null)}
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Generating...' : 'Generate Comments'}
              </button>
              <button
                onClick={() => setShowContextEditor(false)}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Variations */}
      {!showContextEditor && variations.length > 0 && (
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
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleFillForm(variation.text)}
                        className="btn btn-primary text-sm"
                      >
                        Fill Form
                      </button>
                      <button
                        onClick={() => handleUseVariation(variation)}
                        className="btn btn-secondary text-sm"
                      >
                        Copy
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