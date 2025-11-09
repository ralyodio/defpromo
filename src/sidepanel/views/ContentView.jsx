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
                  // Use replaceChildren() for safer DOM manipulation
                  element.replaceChildren();
                  
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