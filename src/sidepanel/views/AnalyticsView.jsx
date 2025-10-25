import React, { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

const AnalyticsView = ({ activeProject }) => {
  const [analytics, setAnalytics] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    byPlatform: {},
    byType: {},
    recentActivity: [],
  });
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeProject) {
      loadAnalytics();
    }
  }, [activeProject]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await db.analytics
        .where('projectId')
        .equals(activeProject.id)
        .toArray();

      setAnalytics(data);
      calculateStats(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const byPlatform = {};
    const byType = {};
    const recentActivity = [];

    data.forEach((item) => {
      // Count by platform
      byPlatform[item.platform] = (byPlatform[item.platform] || 0) + 1;

      // Count by type
      byType[item.type] = (byType[item.type] || 0) + 1;

      // Recent activity (last 30 days)
      const daysSince = (Date.now() - item.submittedAt) / (1000 * 60 * 60 * 24);
      if (daysSince <= 30) {
        const date = new Date(item.submittedAt).toLocaleDateString();
        const existing = recentActivity.find((a) => a.date === date);
        if (existing) {
          existing.count++;
        } else {
          recentActivity.push({ date, count: 1 });
        }
      }
    });

    setStats({
      total: data.length,
      byPlatform,
      byType,
      recentActivity: recentActivity.sort((a, b) => new Date(a.date) - new Date(b.date)),
    });
  };

  const handleUpdateEngagement = async (analyticsId) => {
    const likes = prompt('Enter number of likes:');
    const comments = prompt('Enter number of comments:');
    const shares = prompt('Enter number of shares:');

    if (likes === null) return;

    try {
      const item = await db.analytics.get(analyticsId);
      if (item) {
        item.engagement = {
          likes: parseInt(likes) || 0,
          comments: parseInt(comments) || 0,
          shares: parseInt(shares) || 0,
          updatedAt: Date.now(),
        };
        await db.analytics.put(item);
        await loadAnalytics();
      }
    } catch (error) {
      console.error('Failed to update engagement:', error);
    }
  };

  const getPlatformData = () => {
    return Object.entries(stats.byPlatform).map(([platform, count]) => ({
      platform: platform.charAt(0).toUpperCase() + platform.slice(1),
      submissions: count,
    }));
  };

  const getTypeData = () => {
    return Object.entries(stats.byType).map(([type, count]) => ({
      name: type.charAt(0).toUpperCase() + type.slice(1),
      value: count,
    }));
  };

  const getTopPerformers = () => {
    return analytics
      .filter((a) => a.engagement && (a.engagement.likes + a.engagement.comments + a.engagement.shares) > 0)
      .sort((a, b) => {
        const scoreA = a.engagement.likes + a.engagement.comments * 2 + a.engagement.shares * 3;
        const scoreB = b.engagement.likes + b.engagement.comments * 2 + b.engagement.shares * 3;
        return scoreB - scoreA;
      })
      .slice(0, 5);
  };

  if (!activeProject) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Please select a project first</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Analytics Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Total Submissions</h3>
          <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-1">Platforms Used</h3>
          <p className="text-3xl font-bold text-gray-900">{Object.keys(stats.byPlatform).length}</p>
        </div>
        <div className="card">
          <h3 className="text-sm font-medium text-gray-600 mb-1">This Month</h3>
          <p className="text-3xl font-bold text-gray-900">
            {stats.recentActivity.reduce((sum, day) => sum + day.count, 0)}
          </p>
        </div>
      </div>

      {stats.total === 0 ? (
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data yet</h3>
          <p className="text-gray-600">
            Start using the auto-fill feature on social media platforms to track your activity
          </p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Platform Distribution */}
            {getPlatformData().length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Submissions by Platform</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={getPlatformData()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="platform" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="submissions" fill="#0ea5e9" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Content Type Distribution */}
            {getTypeData().length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4">Posts vs Comments</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={getTypeData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getTypeData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          {stats.recentActivity.length > 0 && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4">Activity Timeline (Last 30 Days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.recentActivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Performers */}
          {getTopPerformers().length > 0 && (
            <div className="card mb-6">
              <h3 className="text-lg font-semibold mb-4">Top Performing Content</h3>
              <div className="space-y-3">
                {getTopPerformers().map((item) => {
                  const score =
                    item.engagement.likes +
                    item.engagement.comments * 2 +
                    item.engagement.shares * 3;
                  return (
                    <div key={item.id} className="border-l-4 border-primary-500 pl-4 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">
                          {item.platform.toUpperCase()} • {item.type}
                        </span>
                        <span className="text-sm font-bold text-primary-600">Score: {score}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-600">
                        <span>❤️ {item.engagement.likes}</span>
                        <span>💬 {item.engagement.comments}</span>
                        <span>🔄 {item.engagement.shares}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.submittedAt).toLocaleString()}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Submissions */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Recent Submissions</h3>
            <div className="space-y-2">
              {analytics.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer"
                  onClick={() => setSelectedMetric(item)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {item.platform.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {item.type === 'post' ? '📝' : '💬'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {new Date(item.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateEngagement(item.id);
                    }}
                    className="btn btn-secondary text-xs"
                  >
                    Update Metrics
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Engagement Modal */}
      {selectedMetric && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedMetric(null)}
        >
          <div className="card max-w-md w-full m-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Submission Details</h3>
            <div className="space-y-3">
              <div>
                <span className="label">Platform:</span>
                <p className="text-gray-900">{selectedMetric.platform.toUpperCase()}</p>
              </div>
              <div>
                <span className="label">Type:</span>
                <p className="text-gray-900">{selectedMetric.type}</p>
              </div>
              <div>
                <span className="label">Submitted:</span>
                <p className="text-gray-900">
                  {new Date(selectedMetric.submittedAt).toLocaleString()}
                </p>
              </div>
              {selectedMetric.engagement && (
                <div>
                  <span className="label">Engagement:</span>
                  <div className="flex gap-4 mt-1">
                    <span>❤️ {selectedMetric.engagement.likes}</span>
                    <span>💬 {selectedMetric.engagement.comments}</span>
                    <span>🔄 {selectedMetric.engagement.shares}</span>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedMetric(null)}
              className="btn btn-secondary w-full mt-4"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsView;