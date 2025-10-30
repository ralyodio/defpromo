import React, { useState } from 'react';
import { db } from '../../storage/db';
import { scrapeAndExtract } from '../../services/scraper';
import { generateProjectMetadata, suggestSubredditsAndHashtags } from '../../services/openai';
import ProjectSuggestions from '../../components/ProjectSuggestions';

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
      console.log('Got search keywords:', result.searchKeywords);

      if (!result.subreddits || result.subreddits.length === 0) {
        console.warn('No subreddits returned!');
      }
      if (!result.hashtags || result.hashtags.length === 0) {
        console.warn('No hashtags returned!');
      }
      if (!result.searchKeywords || result.searchKeywords.length === 0) {
        console.warn('No search keywords returned!');
      }

      await db.projects.update(keywordsProject.id, {
        suggestedSubreddits: result.subreddits || [],
        suggestedHashtags: result.hashtags || [],
        suggestedSearchKeywords: result.searchKeywords || [],
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
                          <p className="text-xs font-semibold text-gray-700">Marketing Suggestions:</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowKeywordsForm(project);
                            }}
                            disabled={loading}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            title="Generate marketing suggestions with keywords"
                          >
                            {(project.suggestedSubreddits?.length > 0 || project.suggestedHashtags?.length > 0 || project.suggestedSearchKeywords?.length > 0) ? 'Refresh' : 'Generate'}
                          </button>
                        </div>
                        {(project.suggestedSubreddits?.length > 0 || project.suggestedHashtags?.length > 0 || project.suggestedSearchKeywords?.length > 0) ? (
                          <ProjectSuggestions
                            subreddits={project.suggestedSubreddits || []}
                            hashtags={project.suggestedHashtags || []}
                            searchKeywords={project.suggestedSearchKeywords || []}
                            compact={true}
                          />
                        ) : (
                          <p className="text-xs text-gray-500 italic">
                            Click "Generate" to get marketing suggestions
                          </p>
                        )}
                      </div>
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