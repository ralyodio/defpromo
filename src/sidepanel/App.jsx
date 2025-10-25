import React, { useState, useEffect } from 'react';
import { db } from '../storage/db';
import ErrorBoundary from '../components/ErrorBoundary';
import Toast from '../components/Toast';
import Loading from '../components/Loading';

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

  useEffect(() => {
    loadProjects();
  }, []);

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

  const handleProjectChange = async (projectId) => {
    try {
      const project = await db.projects.get(projectId);
      setActiveProject(project);
      
      // Save active project to settings
      await db.settings.put({
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
          />
        );
      case 'content':
        return (
          <ContentView
            activeProject={activeProject}
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
    return <Loading message="Loading DefNotPromo..." />;
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
          <h1 className="text-xl font-bold text-gray-900">DefNotPromo</h1>
          {activeProject && (
            <div className="text-sm text-gray-600">
              Project: <span className="font-medium">{activeProject.name}</span>
            </div>
          )}
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
            onClick={() => setCurrentView('content')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              currentView === 'content'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            disabled={!activeProject}
          >
            Content
          </button>
          <button
            onClick={() => setCurrentView('analytics')}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              currentView === 'analytics'
                ? 'bg-primary-50 text-primary-700 border-b-2 border-primary-600'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
            disabled={!activeProject}
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