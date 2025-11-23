import React, { useState, useEffect } from 'react';
import { db } from '../storage/db';
import { runMigrations, needsMigration } from '../storage/migrations';
import ErrorBoundary from '../components/ErrorBoundary';
import Toast from '../components/Toast';
import Loading from '../components/Loading';
import CostTracker from '../components/CostTracker';

// Import views
import ProjectsView from './views/ProjectsView';
import ContentView from './views/ContentView';
import AnalyticsView from './views/AnalyticsView';
import SettingsView from './views/SettingsView';

const App = () => {
  const [currentView, setCurrentView] = useState('projects');
  const [activeProject, setActiveProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [toast, setToast] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [costRefreshKey, setCostRefreshKey] = useState(0);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Check if migrations are needed
      const migrationNeeded = await needsMigration();
      if (migrationNeeded) {
        console.log('Running database migrations...');
        await runMigrations();
        console.log('Database migrations complete');
      }
      
      // Load projects after migrations
      await loadProjects();
    } catch (error) {
      console.error('Failed to initialize app:', error);
      showToast('Failed to initialize app', 'error');
      setInitialLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const allProjects = await db.projects.toArray();
      setProjects(allProjects);
      
      // Load active project from storage
      const settings = await db.settings.get('main');
      if (settings?.activeProjectId) {
        const active = await db.projects.get(settings.activeProjectId);
        setActiveProject(active);
      } else if (allProjects.length > 0) {
        setActiveProject(allProjects[0]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      showToast('Failed to load projects', 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleCostUpdate = () => {
    // Increment the refresh key to trigger CostTracker re-render
    console.log('Cost update triggered, incrementing refresh key from', costRefreshKey, 'to', costRefreshKey + 1);
    setCostRefreshKey(prev => prev + 1);
  };

  const handleProjectChange = async (projectId) => {
    try {
      const project = await db.projects.get(projectId);
      setActiveProject(project);
      
      // Save active project to settings - MUST preserve existing settings!
      const existingSettings = await db.settings.get('main') || {};
      await db.settings.put({
        ...existingSettings,
        id: 'main',
        activeProjectId: projectId,
      });
    } catch (error) {
      console.error('Failed to change project:', error);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'projects':
        return (
          <ProjectsView
            projects={projects}
            activeProject={activeProject}
            onProjectChange={handleProjectChange}
            onProjectsUpdate={loadProjects}
            onCostUpdate={handleCostUpdate}
          />
        );
      case 'content':
        return (
          <ContentView
            activeProject={activeProject}
            onCostUpdate={handleCostUpdate}
          />
        );
      case 'analytics':
        return (
          <AnalyticsView
            activeProject={activeProject}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return <ProjectsView />;
    }
  };

  if (initialLoading) {
    return <Loading message="Loading DefPromo..." />;
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-gray-50">
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">DefPromo</h1>
          <div className="flex items-center gap-3">
            {activeProject && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 border border-primary-200 rounded-lg">
                <div className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></div>
                <div className="text-sm">
                  <span className="text-gray-600">Active:</span>{' '}
                  <span className="font-semibold text-primary-700">{activeProject.name}</span>
                </div>
              </div>
            )}
            <CostTracker
              activeProject={activeProject}
              projects={projects}
              refreshKey={costRefreshKey}
            />
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4">
        <div className="flex space-x-1">
          <button
            onClick={() => setCurrentView('projects')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              currentView === 'projects'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Projects
          </button>
          <button
            onClick={() => activeProject && setCurrentView('content')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              currentView === 'content'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : !activeProject
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title={!activeProject ? 'Please select a project first' : ''}
          >
            Content
          </button>
          <button
            onClick={() => activeProject && setCurrentView('analytics')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              currentView === 'analytics'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : !activeProject
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            title={!activeProject ? 'Please select a project first' : ''}
          >
            Analytics
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              currentView === 'settings'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Settings
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;