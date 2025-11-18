import React, { useState, useEffect } from 'react';
import { getProjectCost, getCostByProject } from '../services/apiCost';

/**
 * CostTracker Component
 * Displays API usage costs for the active project
 */
const CostTracker = ({ activeProject, projects = [], refreshKey = 0 }) => {
  const [projectCost, setProjectCost] = useState(0);
  const [allCosts, setAllCosts] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCosts();
  }, [activeProject, refreshKey]);

  const loadCosts = async () => {
    try {
      setLoading(true);
      
      // Get cost for active project
      if (activeProject?.id) {
        const cost = await getProjectCost(activeProject.id);
        setProjectCost(cost);
      }
      
      // Get costs for all projects
      const costs = await getCostByProject();
      setAllCosts(costs);
    } catch (error) {
      console.error('Failed to load costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTotalCost = () => {
    return Object.values(allCosts).reduce((sum, cost) => sum + cost, 0).toFixed(2);
  };

  const formatCost = (cost) => {
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
        <span className="text-xs text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        title="Click to see cost breakdown"
      >
        <svg
          className="w-4 h-4 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="text-xs">
          {activeProject ? (
            <>
              <span className="text-gray-600">Project:</span>{' '}
              <span className="font-semibold text-green-700">{formatCost(projectCost)}</span>
            </>
          ) : (
            <>
              <span className="text-gray-600">Total:</span>{' '}
              <span className="font-semibold text-green-700">{formatCost(parseFloat(getTotalCost()))}</span>
            </>
          )}
        </div>
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDetails && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDetails(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">API Cost Breakdown</h3>
                <button
                  onClick={() => setShowDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Total Cost */}
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-xs text-gray-600 mb-1">Total Spent (All Projects)</div>
                <div className="text-2xl font-bold text-green-700">{formatCost(parseFloat(getTotalCost()))}</div>
              </div>

              {/* Per-Project Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700 mb-2">By Project:</div>
                {projects.length === 0 ? (
                  <div className="text-xs text-gray-500 italic">No projects yet</div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {projects.map((project) => {
                      const cost = allCosts[project.id] || 0;
                      const isActive = activeProject?.id === project.id;
                      return (
                        <div
                          key={project.id}
                          className={`flex items-center justify-between p-2 rounded ${
                            isActive ? 'bg-primary-50 border border-primary-200' : 'bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {isActive && (
                              <div className="w-1.5 h-1.5 bg-primary-500 rounded-full flex-shrink-0"></div>
                            )}
                            <span className="text-xs text-gray-700 truncate" title={project.name}>
                              {project.name}
                            </span>
                          </div>
                          <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${
                            cost > 0 ? 'text-green-700' : 'text-gray-400'
                          }`}>
                            {formatCost(cost)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Info Note */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Costs are calculated based on OpenAI API usage (tokens used × pricing).
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CostTracker;