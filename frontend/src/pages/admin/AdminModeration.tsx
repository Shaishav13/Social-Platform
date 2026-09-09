import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import type { ModerationReport } from '../../types';
import { Icon } from '../../components/ui/Icon';

export const AdminModeration: React.FC = () => {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/admin/moderation/reports');
      if (res.data?.data) {
        setReports(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load moderation reports:', err);
      setError('Unable to load moderation reports queue');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolve = async (id: string, action: 'dismiss' | 'delete_target') => {
    try {
      setError(null);
      await api.post(`/admin/moderation/reports/${id}/resolve`, { action });
      setReports((prev) => prev.filter((r) => r.id !== id));
      setSuccessMsg(
        action === 'delete_target'
          ? 'Content taken down and report marked resolved.'
          : 'Report dismissed without action.'
      );
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to process report');
    }
  };

  return (
    <div className="wren-admin-page">
      {/* Header */}
      <div className="wren-admin-page-header">
        <div>
          <h1 className="wren-admin-page-title type-display-m">Content & Editorial Moderation</h1>
          <p className="wren-admin-page-desc type-meta">
            Inspect reported correspondence, maintain community decorum, and resolve reader complaints.
          </p>
        </div>
        <button
          type="button"
          onClick={loadReports}
          disabled={isLoading}
          className="wren-button wren-button--ghost"
        >
          {isLoading ? 'Checking Queue...' : 'Refresh Queue'}
        </button>
      </div>

      {successMsg && (
        <div className="wren-admin-alert wren-admin-alert--success" role="status">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="wren-admin-alert wren-admin-alert--error" role="alert">
          {error}
        </div>
      )}

      <div className="wren-admin-panel-card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="type-meta">Reviewing flagged correspondence ledger...</div>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: '3.5rem 2rem', textAlign: 'center' }}>
            <div style={{ margin: '0 auto 1rem', width: '48px', height: '48px', color: 'var(--moss-600)' }}>
              <Icon name="check" size={48} />
            </div>
            <h2 className="type-ui-l" style={{ marginBottom: '0.5rem' }}>
              The Archive is Serene
            </h2>
            <p className="type-meta" style={{ maxWidth: '420px', margin: '0 auto' }}>
              No pending reports or flagged correspondence currently require curator review.
            </p>
          </div>
        ) : (
          <div className="wren-admin-table-container">
            <table className="wren-admin-table">
              <thead>
                <tr>
                  <th>Reported Target</th>
                  <th>Reason Given</th>
                  <th>Flagged By</th>
                  <th>Date Filed</th>
                  <th style={{ textAlign: 'right' }}>Resolution</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td>
                      <div>
                        <span className="wren-badge wren-badge--default" style={{ marginBottom: '0.25rem' }}>
                          {report.target_type.toUpperCase()}
                        </span>
                        <div
                          className="type-body-serif"
                          style={{
                            fontSize: '0.95rem',
                            maxWidth: '360px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {report.target_content || `Target ID: ${report.target_id.slice(0, 8)}...`}
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="type-ui-s" style={{ color: 'var(--wine-700)' }}>
                        {report.reason}
                      </span>
                    </td>

                    <td className="type-meta">@{report.reporter_username || 'anonymous'}</td>

                    <td className="type-meta">
                      {new Date(report.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div className="wren-admin-row-actions">
                        <button
                          type="button"
                          onClick={() => handleResolve(report.id, 'dismiss')}
                          className="wren-button wren-button--ghost"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(report.id, 'delete_target')}
                          className="wren-button wren-button--rust"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                        >
                          Take Down
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminModeration;
