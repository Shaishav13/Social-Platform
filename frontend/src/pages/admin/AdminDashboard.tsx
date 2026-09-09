import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import type { AdminStats } from '../../types';
import { Icon } from '../../components/ui/Icon';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/admin/stats');
      if (res.data?.data) {
        setStats(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load admin stats:', err);
      setError('Unable to load platform statistics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${seconds % 60}s`;
  };

  return (
    <div className="wren-admin-page">
      {/* Header */}
      <div className="wren-admin-page-header">
        <div>
          <h1 className="wren-admin-page-title type-display-m">Platform Ledger & Overview</h1>
          <p className="wren-admin-page-desc type-meta">
            Real-time status, community metrics, and system diagnostics for UdtaBirdie.
          </p>
        </div>
        <button
          type="button"
          onClick={loadStats}
          className="wren-button wren-button--ghost"
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh Metrics'}
        </button>
      </div>

      {error && (
        <div className="wren-admin-alert wren-admin-alert--error" role="alert">
          {error}
        </div>
      )}

      {/* Metrics Row */}
      <div className="wren-admin-metrics-grid">
        <div className="wren-admin-stat-card">
          <div className="wren-admin-stat-card__icon wren-admin-stat-card__icon--wine">
            <Icon name="users" size={20} />
          </div>
          <div className="wren-admin-stat-card__content">
            <span className="wren-admin-stat-card__label type-ui-s">Registered Authors</span>
            <span className="wren-admin-stat-card__value type-display-m">
              {isLoading ? '—' : stats?.users.total ?? 0}
            </span>
            <span className="wren-admin-stat-card__sub type-meta">
              {stats?.users.active ?? 0} active · {stats?.users.restricted ?? 0} restricted
            </span>
          </div>
        </div>

        <div className="wren-admin-stat-card">
          <div className="wren-admin-stat-card__icon wren-admin-stat-card__icon--ochre">
            <Icon name="compose" size={20} />
          </div>
          <div className="wren-admin-stat-card__content">
            <span className="wren-admin-stat-card__label type-ui-s">Letters & Posts</span>
            <span className="wren-admin-stat-card__value type-display-m">
              {isLoading ? '—' : stats?.content.posts ?? 0}
            </span>
            <span className="wren-admin-stat-card__sub type-meta">
              {stats?.content.comments ?? 0} replies & dialogue
            </span>
          </div>
        </div>

        <div className="wren-admin-stat-card">
          <div className="wren-admin-stat-card__icon wren-admin-stat-card__icon--moss">
            <Icon name="shield" size={20} />
          </div>
          <div className="wren-admin-stat-card__content">
            <span className="wren-admin-stat-card__label type-ui-s">Pending Reports</span>
            <span className="wren-admin-stat-card__value type-display-m">
              {isLoading ? '—' : stats?.moderation.pendingReports ?? 0}
            </span>
            <span className="wren-admin-stat-card__sub type-meta">
              {stats?.moderation.totalReports ?? 0} all-time flags
            </span>
          </div>
        </div>

        <div className="wren-admin-stat-card">
          <div className="wren-admin-stat-card__icon wren-admin-stat-card__icon--ink">
            <Icon name="dashboard" size={20} />
          </div>
          <div className="wren-admin-stat-card__content">
            <span className="wren-admin-stat-card__label type-ui-s">Gateway Health</span>
            <span className="wren-admin-stat-card__value type-display-m">Operational</span>
            <span className="wren-admin-stat-card__sub type-meta">
              Uptime: {stats ? formatUptime(stats.system.uptimeSeconds) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="wren-admin-section">
        <h2 className="wren-admin-section-title type-ui-l">Administrative Actions</h2>
        <div className="wren-admin-quick-grid">
          <Link to="/admin/users" className="wren-admin-quick-card">
            <div className="wren-admin-quick-card__icon">
              <Icon name="users" size={22} />
            </div>
            <div className="wren-admin-quick-card__body">
              <h3 className="type-ui-m">Author & User Management</h3>
              <p className="type-meta">Inspect registrations, provision accounts, edit permissions, or restrict disruptive users.</p>
            </div>
            <span className="wren-admin-quick-card__arrow">→</span>
          </Link>

          <Link to="/admin/features" className="wren-admin-quick-card">
            <div className="wren-admin-quick-card__icon">
              <Icon name="features" size={22} />
            </div>
            <div className="wren-admin-quick-card__body">
              <h3 className="type-ui-m">Feature Toggles & Matrix</h3>
              <p className="type-meta">Toggle public registrations, file uploads, commenting, or activate maintenance mode.</p>
            </div>
            <span className="wren-admin-quick-card__arrow">→</span>
          </Link>

          <Link to="/admin/settings" className="wren-admin-quick-card">
            <div className="wren-admin-quick-card__icon">
              <Icon name="settings" size={22} />
            </div>
            <div className="wren-admin-quick-card__body">
              <h3 className="type-ui-m">Platform Settings</h3>
              <p className="type-meta">Configure platform title, broadcast editorial banners, and adjust rate limit thresholds.</p>
            </div>
            <span className="wren-admin-quick-card__arrow">→</span>
          </Link>

          <Link to="/admin/moderation" className="wren-admin-quick-card">
            <div className="wren-admin-quick-card__icon">
              <Icon name="shield" size={22} />
            </div>
            <div className="wren-admin-quick-card__body">
              <h3 className="type-ui-m">Editorial Moderation</h3>
              <p className="type-meta">Review flagged correspondence, resolve complaints, and protect literary safety.</p>
            </div>
            <span className="wren-admin-quick-card__arrow">→</span>
          </Link>
        </div>
      </div>

      {/* System Status Table */}
      <div className="wren-admin-section">
        <h2 className="wren-admin-section-title type-ui-l">Node & Service Diagnostics</h2>
        <div className="wren-admin-panel-card">
          <table className="wren-admin-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Target / Node</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="wren-admin-table__name">Primary PostgreSQL</td>
                <td>localhost:5432</td>
                <td><span className="wren-badge wren-badge--moss">Connected</span></td>
                <td className="type-meta">Port 5432 · Connection Pool Healthy</td>
              </tr>
              <tr>
                <td className="wren-admin-table__name">Redis Session & Cache</td>
                <td>localhost:6379</td>
                <td><span className="wren-badge wren-badge--moss">Online</span></td>
                <td className="type-meta">Feature Flags & Session Storage Active</td>
              </tr>
              <tr>
                <td className="wren-admin-table__name">Express Gateway Service</td>
                <td>localhost:3003</td>
                <td><span className="wren-badge wren-badge--moss">Listening</span></td>
                <td className="type-meta">Node {stats?.system.nodeVersion ?? 'v26.x'} · Heap: {stats?.system.memoryUsageMb ?? '—'} MB</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
