import React, { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import { generateVariations, suggestSubredditsAndHashtags } from '../../services/openai';
import ProjectSuggestions from '../../components/ProjectSuggestions';

const ContentView = ({ activeProject }) => {
  const [contentType, setContentType] = useState('comment');
  const [variations, setVariations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editedText, setEditedText] = useState('');
  const [history, setHistory] = useState([]);
  const [showContextEditor, setShowContextEditor] = useState(false);
  const [contextTitle, setContextTitle] = useState('');
  const [contextContent, setContextContent] = useState('');
  const [keywords, setKeywords] = useState('');
  const [generatedSubreddits, setGeneratedSubreddits] = useState([]);
  const [generatedHashtags, setGeneratedHashtags] = useState([]);
  const [generatedSearchKeywords, setGeneratedSearchKeywords] = useState([]);
  const [loadingKeywords, setLoadingKeywords] = useState(false);

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
        throw new Error('No active tab found. Make sure you have a supported page open.');
      }

      const tab = tabs[0];
      
      if (!tab?.id) {
        throw new Error('Tab has no ID');
      }

      // Check if we're on a supported platform
      const isReddit = tab.url?.includes('reddit.com');
      const isTwitter = tab.url?.includes('twitter.com') || tab.url?.includes('x.com');
      const isLinkedIn = tab.url?.includes('linkedin.com');
      const isBluesky = tab.url?.includes('bsky.app') || tab.url?.includes('bsky.social');
      const isPrimal = tab.url?.includes('primal.net');
      const isFacebook = tab.url?.includes('facebook.com');
      const isInstagram = tab.url?.includes('instagram.com');
      const isThreads = tab.url?.includes('threads.net');
      const isYouTube = tab.url?.includes('youtube.com');
      const isTikTok = tab.url?.includes('tiktok.com');
      
      if (!isReddit && !isTwitter && !isLinkedIn && !isBluesky && !isPrimal && 
          !isFacebook && !isInstagram && !isThreads && !isYouTube && !isTikTok) {
        throw new Error(`Not on a supported page. Current URL: ${tab.url || 'unknown'}. Supported: Reddit, Twitter/X, LinkedIn, Bluesky, Primal, Facebook, Instagram, Threads, YouTube, TikTok`);
      }

      console.log('Sending message to tab:', tab.id, tab.url);

      // Send message to content script with timeout
      const response = await Promise.race([
        api.tabs.sendMessage(tab.id, {
          type: 'GET_PAGE_CONTEXT',
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout: Content script did not respond. Refresh the page and try again.')), 5000)
        )
      ]);

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
      setSuccess('Copied to clipboard!');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
    }
  };

  const handleGenerateFromKeywords = async () => {
    if (!keywords.trim()) {
      setError('Please enter keywords');
      return;
    }

    setLoadingKeywords(true);
    setError(null);

    try {
      const settings = await db.settings.get('main');
      if (!settings?.openaiKey) {
        throw new Error('Please configure your OpenAI API key in Settings');
      }

      const result = await suggestSubredditsAndHashtags({
        apiKey: settings.openaiKey,
        productName: activeProject.name,
        description: activeProject.description || '',
        targetAudience: activeProject.targetAudience || '',
        keyFeatures: activeProject.keyFeatures || [],
        keywords: keywords,
      });

      console.log('API Result:', result);
      console.log('Subreddits:', result.subreddits);
      console.log('Hashtags:', result.hashtags);
      console.log('Search Keywords:', result.searchKeywords);
      
      setGeneratedSubreddits(result.subreddits || []);
      setGeneratedHashtags(result.hashtags || []);
      setGeneratedSearchKeywords(result.searchKeywords || []);
      
      const keywordCount = (result.searchKeywords || []).length;
      setSuccess(`Generated ${result.subreddits?.length || 0} subreddits, ${result.hashtags?.length || 0} hashtags, and ${keywordCount} search keywords!`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingKeywords(false);
    }
  };

  const handleExportJSON = () => {
    const data = {
      project: activeProject.name,
      keywords: keywords,
      generatedAt: new Date().toISOString(),
      subreddits: generatedSubreddits.map(s => ({
        name: s,
        url: `https://reddit.com/r/${s}`,
      })),
      hashtags: generatedHashtags.map(h => ({
        tag: h,
        platforms: ['Twitter/X', 'Instagram', 'Threads', 'Bluesky', 'Primal'],
      })),
      searchKeywords: generatedSearchKeywords.map(k => ({
        keyword: k,
        platforms: ['Facebook', 'YouTube', 'LinkedIn'],
      })),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeProject.name.replace(/\s+/g, '-')}-keywords-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setSuccess('Exported to JSON!');
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleCopySubreddits = async () => {
    const text = generatedSubreddits.map(s => `r/${s}`).join('\n');
    await handleCopy(text);
  };

  const handleCopyHashtags = async () => {
    const text = generatedHashtags.map(h => `#${h}`).join(' ');
    await handleCopy(text);
  };

  const handleCopySearchKeywords = async () => {
    const text = generatedSearchKeywords.join(', ');
    await handleCopy(text);
  };

  const handleUseVariation = async (variation) => {
    // Copy to clipboard
    await handleCopy(variation.text);
  };

  const handleFillForm = async (text, variationId) => {
    // Clear previous messages
    setError(null);
    setSuccess(null);
    
    try {
      // Use browser API for Firefox compatibility
      const api = typeof browser !== 'undefined' ? browser : chrome;
      const isFirefox = typeof browser !== 'undefined';
      
      // Get current tab
      const tabs = await api.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0 || !tabs[0]?.id) {
        setError('No active tab found');
        return;
      }

      const tab = tabs[0];
      
      // Detect platform from URL
      const url = tab.url || '';
      let platform = 'unknown';
      if (url.includes('reddit.com')) platform = 'reddit';
      else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
      else if (url.includes('linkedin.com')) platform = 'linkedin';
      else if (url.includes('facebook.com')) platform = 'facebook';
      else if (url.includes('instagram.com')) platform = 'instagram';
      else if (url.includes('threads.net')) platform = 'threads';
      else if (url.includes('youtube.com')) platform = 'youtube';
      else if (url.includes('tiktok.com')) platform = 'tiktok';
      else if (url.includes('bsky.app') || url.includes('bsky.social')) platform = 'bluesky';
      else if (url.includes('primal.net')) platform = 'primal';
      else if (url.includes('slack.com')) platform = 'slack';
      else if (url.includes('discord.com')) platform = 'discord';
      else if (url.includes('telegram.org')) platform = 'telegram';
      else if (url.includes('stacker.news')) platform = 'stacker';

      // Define the function to inject
      const injectFunc = (commentText) => {
          // Helper function to fill element
          const fillElement = (element, text) => {
            if (!element) return false;
            
            if (element.contentEditable === 'true' || element.getAttribute('contenteditable') === 'true') {
              // For contenteditable elements
              element.focus();
              
              // For Lexical editor (Reddit)
              if (element.hasAttribute('data-lexical-editor')) {
                // Method 1: Try using clipboard paste
                element.focus();
                
                // Create a paste event
                const dataTransfer = new DataTransfer();
                dataTransfer.setData('text/plain', text);
                const pasteEvent = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: dataTransfer
                });
                
                if (element.dispatchEvent(pasteEvent)) {
                  // Paste event handled
                  return true;
                }
                
                // Method 2: Fallback - use execCommand if available
                try {
                  document.execCommand('selectAll', false, null);
                  document.execCommand('delete', false, null);
                  document.execCommand('insertText', false, text);
                  element.dispatchEvent(new Event('input', { bubbles: true }));
                  return true;
                } catch (e) {
                  // Method 3: Direct DOM manipulation as last resort
                  element.innerHTML = '';
                  
                  const lines = text.split('\n');
                  lines.forEach((line) => {
                    const p = document.createElement('p');
                    p.className = 'first:mt-0 last:mb-0';
                    p.setAttribute('dir', 'auto');
                    
                    if (line.trim()) {
                      const span = document.createElement('span');
                      span.setAttribute('data-lexical-text', 'true');
                      span.textContent = line;
                      p.appendChild(span);
                    } else {
                      p.appendChild(document.createElement('br'));
                    }
                    
                    element.appendChild(p);
                  });
                  
                  // Fire comprehensive events
                  element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                  element.dispatchEvent(new Event('change', { bubbles: true }));
                  element.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true }));
                  element.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
                }
              } else {
                // For other contenteditable elements (Twitter/X, etc.)
                element.focus();
                
                // Best approach: Use execCommand which React editors handle well
                try {
                  // Select all existing content
                  const selection = window.getSelection();
                  const range = document.createRange();
                  range.selectNodeContents(element);
                  selection.removeAllRanges();
                  selection.addRange(range);
                  
                  // Use execCommand to insert text (works with most React editors)
                  const success = document.execCommand('insertText', false, text);
                  
                  if (success) {
                    return true;
                  }
                } catch (e) {
                  console.log('execCommand failed:', e);
                }
                
                // Fallback: Try clipboard paste event (Twitter should handle this)
                try {
                  element.focus();
                  
                  // Create clipboard data
                  const clipboardData = new DataTransfer();
                  clipboardData.setData('text/plain', text);
                  
                  const pasteEvent = new ClipboardEvent('paste', {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: clipboardData
                  });
                  
                  element.dispatchEvent(pasteEvent);
                  return true;
                } catch (e) {
                  console.log('Clipboard paste failed:', e);
                }
              }
              
              return true;
            } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
              // For textarea/input elements
              element.focus();
              element.value = text;
              
              // Trigger events
              element.dispatchEvent(new Event('input', { bubbles: true }));
              element.dispatchEvent(new Event('change', { bubbles: true }));
              
              return true;
            }
            
            return false;
          };

          // Priority selectors for specific platforms
          const prioritySelectors = [
            // Reddit - new Lexical editor (rich text mode)
            'div[slot="rte"][data-lexical-editor="true"][contenteditable="true"]',
            'div[name="body"][data-lexical-editor="true"][contenteditable="true"]',
            'div[contenteditable="true"][data-lexical-editor="true"]',
            
            // Reddit - Markdown editor mode
            'textarea[slot="text-input"]',
            'textarea[name="markdown"]',
            'faceplate-textarea[name="markdown"] textarea',
            
            // Twitter/X - main tweet box
            '[data-testid="tweetTextarea_0"]',
            'div[contenteditable="true"][role="textbox"][data-testid="tweetTextarea_0"]',
            
            // LinkedIn - Quill editor
            '.ql-editor[data-placeholder*="Start a post"]',
            '.ql-editor[data-placeholder*="Add a comment"]',
            '.ql-editor[contenteditable="true"]',
            
            // Bluesky - contenteditable
            '[contenteditable="true"][data-testid="composerTextInput"]',
            '[contenteditable="true"][placeholder*="Write your reply"]',
            
            // Primal (Nostr)
            'textarea[placeholder*="What\'s on your mind"]',
            'textarea[placeholder*="Reply"]',
            
            // Facebook - contenteditable
            '[contenteditable="true"][role="textbox"][aria-label*="What\'s on your mind"]',
            '[contenteditable="true"][role="textbox"][aria-label*="Write a comment"]',
            
            // Instagram - textarea
            'textarea[placeholder*="Add a comment"]',
            'textarea[aria-label*="Add a comment"]',
            
            // Threads - textarea and contenteditable
            'textarea[placeholder*="Reply"]',
            'textarea[aria-label*="Reply"]',
            'div[contenteditable="true"][role="textbox"]',
            
            // YouTube - contenteditable
            '#contenteditable-root[contenteditable="true"]',
            'div[id="contenteditable-root"]',
            
            // TikTok - contenteditable
            '[data-e2e="comment-input"]',
            'div[contenteditable="true"][data-text="Add comment..."]',
            
            // Reddit - older comment boxes
            'shreddit-composer textarea',
            'textarea[placeholder*="Share your thoughts" i]',
            'faceplate-textarea[name="comment"]',
          ];

          // Try priority selectors first (visible elements only)
          for (const selector of prioritySelectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              if (fillElement(element, commentText)) {
                return { success: true, selector };
              }
            }
          }

          // Fallback: Try general selectors (visible elements only)
          const fallbackSelectors = [
            'textarea[placeholder*="comment" i]',
            'textarea[placeholder*="reply" i]',
            'textarea[placeholder*="thoughts" i]',
            'textarea[placeholder*="conversation" i]',
            'textarea[name="comment"]',
            'textarea[aria-label*="comment" i]',
            'div[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"]',
            'textarea',
          ];

          for (const selector of fallbackSelectors) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
              if (fillElement(element, commentText)) {
                return { success: true, selector };
              }
            }
          }

          // Last resort: Try all elements even if hidden (might be revealed on interaction)
          for (const selector of [...prioritySelectors, ...fallbackSelectors]) {
            const element = document.querySelector(selector);
            if (element) {
              if (fillElement(element, commentText)) {
                return { success: true, selector, wasHidden: true };
              }
            }
          }
          
          // Return debug info about what was found
          const foundElements = [];
          [...prioritySelectors, ...fallbackSelectors].forEach(sel => {
            const el = document.querySelector(sel);
            if (el) {
              foundElements.push({
                selector: sel,
                visible: el.offsetParent !== null,
                tag: el.tagName
              });
            }
          });
          
          return { 
            success: false, 
            foundElements,
            url: window.location.href
          };
      };

      // Execute script differently based on browser
      let results;
      if (isFirefox) {
        // Firefox Manifest V2: Use tabs.executeScript
        results = await api.tabs.executeScript(tab.id, {
          code: `(${injectFunc.toString()})(${JSON.stringify(text)});`
        });
      } else {
        // Chrome Manifest V3: Use scripting.executeScript
        results = await api.scripting.executeScript({
          target: { tabId: tab.id },
          func: injectFunc,
        args: [text],
      });
      }

      // Check result
      const result = results?.[0]?.result || results?.[0];
      console.log('Fill form result:', result);

      if (result?.success) {
        setError(null);
        const successMsg = result.wasHidden
          ? 'Form filled (element was hidden but filled anyway - check the page)'
          : 'Form filled successfully!';
        console.log(`✓ ${successMsg} using selector: ${result.selector}`);
        
        setSuccess(successMsg);
        // Clear success message after 4 seconds
        setTimeout(() => setSuccess(null), 4000);
        
        // Track analytics
        try {
          const contentId = history[0]?.id || `content-${Date.now()}`;
          await db.analytics.add({
            id: `analytics-${Date.now()}`,
            projectId: activeProject.id,
            contentId: contentId,
            variationId: variationId || 'unknown',
            platform: platform,
            contentType: contentType,
            submittedAt: Date.now(),
          });
          console.log('Analytics tracked:', { platform, contentType, projectId: activeProject.id });
        } catch (analyticsErr) {
          console.error('Failed to track analytics:', analyticsErr);
          // Don't fail the whole operation if analytics fails
        }
      } else {
        // Show detailed error
        const debugInfo = result?.foundElements?.length 
          ? `Found ${result.foundElements.length} elements but none were fillable:\n${JSON.stringify(result.foundElements, null, 2)}`
          : 'No matching form elements found on page';
        
        console.error('Fill form failed:', debugInfo);
        setError(`Could not find form to fill. Try:\n1. Click on the comment box on the page\n2. Then click Fill Form again\n\nDebug: ${debugInfo}`);
      }
    } catch (err) {
      console.error('Failed to fill form:', err);
      setError(`Failed to fill form: ${err.message}`);
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Content Generation</h2>
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200 rounded-lg">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-600 font-medium">Generating content for:</div>
            <div className="text-lg font-bold text-gray-900">{activeProject.name}</div>
            {activeProject.description && (
              <div className="text-sm text-gray-600 mt-1">{activeProject.description}</div>
            )}
          </div>
        </div>

        {/* Project Suggestions - Using reusable component */}
        {(activeProject.suggestedSubreddits?.length > 0 || activeProject.suggestedHashtags?.length > 0 || activeProject.suggestedSearchKeywords?.length > 0) && (
          <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
            <h4 className="text-xs font-semibold text-gray-700 mb-3">Quick Reference</h4>
            <ProjectSuggestions
              subreddits={activeProject.suggestedSubreddits || []}
              hashtags={activeProject.suggestedHashtags || []}
              searchKeywords={activeProject.suggestedSearchKeywords || []}
              onCopy={handleCopy}
              compact={true}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 whitespace-pre-wrap">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ {success}
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
      {/* Keywords Section */}
      <div className="card mb-6">
        <h3 className="text-lg font-semibold mb-4">Generate from Keywords</h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter keywords to generate relevant subreddits, hashtags, and search keywords for your promotional strategy.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="label">Keywords</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="input"
              placeholder="e.g., SaaS, productivity, automation"
            />
          </div>

          <button
            onClick={handleGenerateFromKeywords}
            disabled={loadingKeywords || !keywords.trim()}
            className="btn btn-primary w-full"
          >
            {loadingKeywords ? 'Generating...' : 'Generate Subreddits, Hashtags & Keywords'}
          </button>
        </div>

        {/* Generated Results */}
        {(generatedSubreddits.length > 0 || generatedHashtags.length > 0 || generatedSearchKeywords.length > 0) && (
          <div className="mt-6 space-y-6">
            {/* Subreddits */}
            {generatedSubreddits.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Subreddits</h4>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                      </svg>
                      Reddit
                    </span>
                  </div>
                  <button
                    onClick={handleCopySubreddits}
                    className="btn btn-secondary text-xs"
                  >
                    Copy All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedSubreddits.map((subreddit, index) => (
                    <a
                      key={index}
                      href={`https://reddit.com/r/${subreddit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      r/{subreddit}
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Hashtags */}
            {generatedHashtags.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Hashtags</h4>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                      </svg>
                      Twitter/X
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-pink-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      Instagram
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142l-.126 1.974a11.881 11.881 0 00-2.64-.123c-1.039.06-1.93.36-2.5.84-.482.406-.723.923-.679 1.455.04.48.326.896.804 1.17.563.323 1.32.48 2.25.467 1.15-.062 2.03-.48 2.61-1.24.475-.624.764-1.483.859-2.552l.057-.97 2.024.114c.102.006.2.014.295.023.582.055 1.113.136 1.628.25 1.36.302 2.536.763 3.497 1.372 1.155.732 1.985 1.68 2.467 2.817.136.322.244.656.323 1.001.434 1.892.217 4.007-1.285 6.018-1.442 1.93-3.544 2.9-6.25 2.882z"/>
                      </svg>
                      Threads
                    </span>
                  </div>
                  <button
                    onClick={handleCopyHashtags}
                    className="btn btn-secondary text-xs"
                  >
                    Copy All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedHashtags.map((hashtag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium"
                    >
                      #{hashtag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Search Keywords */}
            {generatedSearchKeywords.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">Search Keywords</h4>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                      </svg>
                      YouTube
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </span>
                  </div>
                  <button
                    onClick={handleCopySearchKeywords}
                    className="btn btn-secondary text-xs"
                  >
                    Copy All
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedSearchKeywords.map((keyword, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium border border-gray-200"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Export Button */}
            <div className="flex justify-end">
              <button
                onClick={handleExportJSON}
                className="btn btn-primary"
              >
                <svg className="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to JSON
              </button>
            </div>
          </div>
        )}
      </div>


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
                        onClick={() => handleFillForm(variation.text, variation.id)}
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