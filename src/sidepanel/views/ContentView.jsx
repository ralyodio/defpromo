import React from 'react';

const ContentView = ({ activeProject }) => {
  if (!activeProject) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Please select a project first</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Content Generation</h2>
      <div className="card">
        <p className="text-gray-600">Content generation UI coming soon...</p>
        <p className="text-sm text-gray-500 mt-2">
          This will allow you to generate promotional content with AI
        </p>
      </div>
    </div>
  );
};

export default ContentView;