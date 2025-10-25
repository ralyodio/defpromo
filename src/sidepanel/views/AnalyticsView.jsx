
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
