import React, { useState } from 'react';
import { db } from '../../storage/db';
import { scrapeAndExtract } from '../../services/scraper';
import { generateProjectMetadata, suggestSubredditsAndHashtags } from '../../services/openai';

const ProjectsView = ({ projects, activeProject, onProjectChange, onProjectsUpdate }) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showKeywordsForm, setShowKeywordsForm] = useState(false);
  const [keywordsProject, setKeywordsProject] = useState(null);
  const [keywords, setKeywords] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Get API keys from settings
      const settings = await db.settings.get('main');
      if (!settings?.scraperKey) {
        setError('Please configure your Browserless API key in Settings');
        setLoading(false);
        return;
      }

      if (!settings?.openaiKey) {
        setError('Please configure your OpenAI API key in Settings');
        setLoading(false);
        return;
      }

      // Step 1: Scrape the URL using Browserless
      const extracted = await scrapeAndExtract({
        url,
        apiKey: settings.scraperKey,
        service: 'browserless',
      });

      // Step 2: Use OpenAI to generate better project metadata
      const metadata = await generateProjectMetadata({
        apiKey: settings.openaiKey,
        url,
        title: extracted.title,
        metaDescription: extracted.description,
        pageText: extracted.text,
      });

      // Step 3: Get subreddit suggestions (don't fail if this errors)
      let subreddits = [];
      try {
        subreddits = await suggestSubreddits({
          apiKey: settings.openaiKey,
          productName: metadata.name,
          description: metadata.description,
          targetAudience: metadata.targetAudience,
          keyFeatures: metadata.keyFeatures,
        });
        console.log('Suggested subreddits:', subreddits);
      } catch (subredditErr) {
        console.error('Failed to get subreddit suggestions:', subredditErr);
        // Continue without subreddits
      }

      // Create project with AI-generated metadata and subreddit suggestions
      const newProject = {
        id: `proj-${Date.now()}`,
        name: metadata.name,
        url,
        description: metadata.description,
        targetAudience: metadata.targetAudience,
        keyFeatures: metadata.keyFeatures,
        tone: metadata.tone,
        suggestedSubreddits: subreddits || [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.projects.add(newProject);
      await onProjectsUpdate();
      
      setUrl('');
      setShowCreateForm(false);
    } catch (err) {
      setError(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (project) => {
    setEditingProject(project.id);
    setEditForm({
      name: project.name,
      url: project.url,
      description: project.description || '',
      targetAudience: project.targetAudience || '',
      tone: project.tone || 'professional',
    });
  };

  const handleSaveEdit = async () => {
    try {
      await db.projects.update(editingProject, {
        ...editForm,
        updatedAt: Date.now(),
      });
      await onProjectsUpdate();
      setEditingProject(null);
      setEditForm({});
    } catch (err) {
      setError(`Failed to update project: ${err.message}`);
    }
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditForm({});
  };

  const handleShowKeywordsForm = async (project) => {
    // Get the latest project data to ensure we have saved keywords
    const latestProject = await db.projects.get(project.id);
    setKeywordsProject(latestProject);
    // Pre-fill with saved keywords if they exist
    setKeywords(latestProject?.marketingKeywords || '');
    setShowKeywordsForm(true);
  };

  const handleGenerateWithKeywords = async () => {
    if (!keywordsProject) return;

    setLoading(true);
    setError(null);

    try {
      const settings = await db.settings.get('main');
      console.log('Settings retrieved:', settings ? 'Found' : 'Not found');
      console.log('OpenAI key present:', settings?.openaiKey ? 'Yes' : 'No');
      console.log('OpenAI key length:', settings?.openaiKey?.length || 0);
      console.log('OpenAI key starts with:', settings?.openaiKey?.substring(0, 7) || 'N/A');
      
      if (!settings?.openaiKey) {
        setError('Please configure your OpenAI API key in Settings. Current settings: ' + JSON.stringify(settings || {}));
        setLoading(false);
        return;
      }

      // Trim the key to remove any whitespace
      const trimmedKey = settings.openaiKey.trim();
      console.log('Generating subreddits and hashtags for:', keywordsProject.name, 'with keywords:', keywords);
      console.log('Using API key (trimmed, first 7 chars):', trimmedKey.substring(0, 7));
      console.log('Project details:', {
        name: keywordsProject.name,
        description: keywordsProject.description,
        targetAudience: keywordsProject.targetAudience,
        keyFeatures: keywordsProject.keyFeatures,
      });

      // Generate both in a single API call
      const result = await suggestSubredditsAndHashtags({
        apiKey: trimmedKey,
        productName: keywordsProject.name,
        description: keywordsProject.description,
        targetAudience: keywordsProject.targetAudience,
        keyFeatures: keywordsProject.keyFeatures,
        keywords: keywords,
      });

      console.log('API call completed. Result:', result);
      console.log('Got subreddits:', result.subreddits);
      console.log('Got hashtags:', result.hashtags);

      if (!result.subreddits || result.subreddits.length === 0) {
        console.warn('No subreddits returned!');
      }
      if (!result.hashtags || result.hashtags.length === 0) {
        console.warn('No hashtags returned!');
      }

      await db.projects.update(keywordsProject.id, {
        suggestedSubreddits: result.subreddits || [],
        suggestedHashtags: result.hashtags || [],
        marketingKeywords: keywords, // Save keywords for future use
        updatedAt: Date.now(),
      });

      console.log('Project updated in database');

      await onProjectsUpdate();
      console.log('Projects list refreshed');
      
      setShowKeywordsForm(false);
      setKeywordsProject(null);
      setKeywords('');
    } catch (err) {
      console.error('Generation error:', err);
      let errorMessage = `Failed to generate subreddits: ${err.message}`;
      
      // Provide helpful guidance for common errors
      if (err.message?.includes('401')) {
        errorMessage += '\n\n⚠️ Your OpenAI API key appears to be invalid or missing. Please:\n1. Go to Settings\n2. Re-enter your OpenAI API key\n3. Save and try again';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project?')) {
      return;
    }

    try {
      await db.projects.delete(projectId);
      await onProjectsUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="btn btn-primary"
        >
          {showCreateForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 relative">
          <div className="pr-10">{error}</div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(error);
            }}
            className="absolute top-2 right-2 p-2 hover:bg-red-100 rounded transition-colors"
            title="Copy error message"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </button>
        </div>
      )}

      {showCreateForm && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Project</h3>
          <p className="text-sm text-gray-600 mb-4">
            Enter your product URL and we'll use AI to analyze the page and generate optimized project details.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Product URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="input"
                placeholder="https://example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                We'll analyze this page with AI to create a complete project profile
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creating Project...' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setUrl('');
                  setError(null);
                }}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
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
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
          <p className="text-gray-600 mb-4">
            Create your first project to start generating promotional content
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((project) => (
            <>
            <div
              key={project.id}
              className={`card transition-all ${
                activeProject?.id === project.id
                  ? 'ring-2 ring-primary-500 bg-primary-50'
                  : ''
              }`}
            >
              {editingProject === project.id ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Edit Project</h3>
                  <div>
                    <label className="label">Project Name</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">URL</label>
                    <input
                      type="url"
                      value={editForm.url}
                      onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="input"
                      rows="3"
                    />
                  </div>
                  <div>
                    <label className="label">Target Audience</label>
                    <input
                      type="text"
                      value={editForm.targetAudience}
                      onChange={(e) => setEditForm({ ...editForm, targetAudience: e.target.value })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Tone</label>
                    <select
                      value={editForm.tone}
                      onChange={(e) => setEditForm({ ...editForm, tone: e.target.value })}
                      className="input"
                    >
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="enthusiastic">Enthusiastic</option>
                      <option value="technical">Technical</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleSaveEdit} className="btn btn-primary">
                      Save Changes
                    </button>
                    <button onClick={handleCancelEdit} className="btn btn-secondary">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="cursor-pointer"
                  onClick={() => onProjectChange(project.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{project.url}</p>
                      {project.description && (
                        <p className="text-sm text-gray-700 mb-3">{project.description}</p>
                      )}
                      <div className="mt-3 mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-700">Suggested Subreddits:</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowKeywordsForm(project);
                            }}
                            disabled={loading}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            title="Generate subreddit suggestions with keywords"
                          >
                            {project.suggestedSubreddits?.length > 0 ? 'Refresh' : 'Generate'}
                          </button>
                        </div>
                        {project.suggestedSubreddits && project.suggestedSubreddits.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {project.suggestedSubreddits.map((subreddit) => (
                              <a
                                key={subreddit}
                                href={`https://www.reddit.com/r/${subreddit}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs hover:bg-orange-200 transition-colors"
                              >
                                r/{subreddit}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">
                            Click "Generate" to get subreddit suggestions
                          </p>
                        )}
                      </div>
                      {project.suggestedHashtags && project.suggestedHashtags.length > 0 && (
                        <div className="mt-3 mb-3">
                          <p className="text-xs font-semibold text-gray-700 mb-2">Suggested Hashtags:</p>
                          <div className="flex flex-wrap gap-2">
                            {project.suggestedHashtags.map((hashtag) => (
                              <div key={hashtag} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                <span>#{hashtag}</span>
                                <div className="flex gap-1 ml-1">
                                  <a
                                    href={`https://x.com/search?q=%23${hashtag}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on X/Twitter"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://bsky.app/search?q=%23${hashtag}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on Bluesky"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://primal.net/search/${encodeURIComponent('#' + hashtag)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on Primal"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M13.5 2c-5.621 0-10.211 4.443-10.475 10h-3.025l5 6.625 5-6.625h-2.975c.257-3.351 3.06-6 6.475-6 3.584 0 6.5 2.916 6.5 6.5s-2.916 6.5-6.5 6.5c-1.863 0-3.542-.793-4.728-2.053l-2.427 3.216c1.877 1.754 4.389 2.837 7.155 2.837 5.79 0 10.5-4.71 10.5-10.5s-4.71-10.5-10.5-10.5z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://www.linkedin.com/feed/hashtag/${hashtag.toLowerCase()}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on LinkedIn"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://www.instagram.com/explore/tags/${hashtag.toLowerCase()}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on Instagram"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://www.threads.net/search?q=%23${hashtag}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on Threads"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://www.youtube.com/hashtag/${hashtag.toLowerCase()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on YouTube"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                  </a>
                                  <a
                                    href={`https://www.tiktok.com/tag/${hashtag.toLowerCase()}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="hover:opacity-70"
                                    title="Search on TikTok"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                                    </svg>
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3 text-xs text-gray-500">
                        Created {new Date(project.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(project);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-2"
                        title="Edit project"
                      >
                        <svg
                          className="h-5 w-5"
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
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(project.id);
                        }}
                        className="text-red-600 hover:text-red-800 p-2"
                        title="Delete project"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Show keywords form right after THIS project if it's the active one */}
            {showKeywordsForm && activeProject?.id === project.id && keywordsProject?.id === project.id && (
              <div className="card border-2 border-primary-300 bg-yellow-50">
                <h3 className="text-lg font-semibold mb-4">📊 Generate Subreddits & Hashtags</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter keywords to find targeted subreddits and hashtags for "<strong>{keywordsProject?.name}</strong>"
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="label">Keywords (comma-separated)</label>
                    <input
                      type="text"
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      className="input"
                      placeholder="e.g., SaaS, directory, software, indie hackers"
                      autoFocus
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Add specific keywords to find more targeted subreddits
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateWithKeywords}
                      disabled={loading}
                      className="btn btn-primary"
                    >
                      {loading ? 'Generating...' : 'Generate Subreddits & Hashtags'}
                    </button>
                    <button
                      onClick={() => {
                        setShowKeywordsForm(false);
                        setKeywordsProject(null);
                        setKeywords('');
                      }}
                      className="btn btn-secondary"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
            </>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectsView;