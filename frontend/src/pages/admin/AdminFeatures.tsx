import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useConfig } from '../../contexts/ConfigContext';
import type { PlatformFeatures } from '../../types';

export const AdminFeatures: React.FC = () => {
  const { refreshConfig } = useConfig();
  const [features, setFeatures] = useState<PlatformFeatures>({
    publicRegistration: true,
    mediaUploads: true,
    commenting: true,
    followRequests: true,
    maintenanceMode: false,
    trendingFeed: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadFeatures();
  }, []);

  const loadFeatures = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/admin/features');
      if (res.data?.data) {
        setFeatures(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load features:', err);
      setError('Failed to fetch platform feature flags');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (key: keyof PlatformFeatures) => {
    setFeatures((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const res = await api.put('/admin/features', features);
      if (res.data?.data) {
        setFeatures(res.data.data);
      }
      await refreshConfig();
      setSuccessMsg('Feature flags successfully persisted.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save feature flags');
    } finally {
      setIsSaving(false);
    }
  };

  const featureList: {
    key: keyof PlatformFeatures;
    title: string;
    description: string;
    isDestructive?: boolean;
  }[] = [
    {
      key: 'publicRegistration',
      title: 'Public Author Registration',
      description:
        'When enabled, new visitors may create accounts freely. When disabled, only administrators can provision new authors.',
    },
    {
      key: 'mediaUploads',
      title: 'Manuscript Media & Imagery',
      description:
        'Allows authors to attach visual prints and illustrations to correspondence. When disabled, only pure prose may be drafted.',
    },
    {
      key: 'commenting',
      title: 'Dialogue & Marginalia Replies',
      description:
        'Enables readers to compose replies and engage in threads beneath published letters. Disabling freezes active discussions.',
    },
    {
      key: 'followRequests',
      title: 'Author Follow & Subscriptions',
      description:
        'Permits authors to subscribe to feeds and accept follow requests from private journals.',
    },
    {
      key: 'trendingFeed',
      title: 'Editorial Trending Margin Notes',
      description:
        'Exposes trending letters and active discussions in the wide-viewport right Margin Notes column.',
    },
    {
      key: 'maintenanceMode',
      title: 'Platform Maintenance Mode',
      description:
        'Gracefully suspends public platform access for standard authors, displaying a scheduled maintenance seal while keeping admin access open.',
      isDestructive: true,
    },
  ];

  return (
    <div className="wren-admin-page">
      {/* Header */}
      <div className="wren-admin-page-header">
        <div>
          <h1 className="wren-admin-page-title type-display-m">Feature Toggles & Matrix</h1>
          <p className="wren-admin-page-desc type-meta">
            Dynamically activate or suspend core platform functionality without requiring server redeployment.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="wren-button wren-button--wine"
        >
          {isSaving ? 'Persisting...' : 'Save Matrix'}
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

      {/* Feature Grid */}
      <div className="wren-admin-panel-card" style={{ padding: '0.5rem 1.5rem' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="type-meta">Reading feature configuration from Redis...</div>
          </div>
        ) : (
          <div className="wren-admin-feature-list">
            {featureList.map((item) => {
              const isChecked = features[item.key];
              return (
                <div
                  key={item.key}
                  className={`wren-admin-feature-row ${
                    item.isDestructive && isChecked ? 'wren-admin-feature-row--warning' : ''
                  }`}
                >
                  <div className="wren-admin-feature-info">
                    <h3 className="type-ui-m wren-admin-feature-title">
                      {item.title}
                      {item.isDestructive && (
                        <span className="wren-badge wren-badge--rust" style={{ marginLeft: '0.5rem' }}>
                          High Impact
                        </span>
                      )}
                    </h3>
                    <p className="type-meta wren-admin-feature-desc">{item.description}</p>
                  </div>

                  <div className="wren-admin-feature-control">
                    <label className="wren-switch">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggle(item.key)}
                        aria-label={item.title}
                      />
                      <span className="wren-switch-slider" />
                    </label>
                    <span className="wren-admin-switch-status type-meta">
                      {isChecked ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFeatures;
