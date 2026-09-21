import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { useConfig } from '../../contexts/ConfigContext';
import type { PlatformSettings } from '../../types';

export const AdminSettings: React.FC = () => {
  const { refreshConfig } = useConfig();
  const [settings, setSettings] = useState<PlatformSettings>({
    siteName: 'UdtaBirdie',
    announcementBanner: '',
    defaultDensity: 'comfortable',
    maxPostLength: 2000,
    rateLimitMaxRequests: 100,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await api.get('/admin/settings');
      if (res.data?.data) {
        setSettings(res.data.data);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError('Failed to fetch platform configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      setError(null);
      const res = await api.put('/admin/settings', settings);
      if (res.data?.data) {
        setSettings(res.data.data);
      }
      await refreshConfig();
      setSuccessMsg('Platform settings saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update platform settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="wren-admin-page">
      {/* Header */}
      <div className="wren-admin-page-header">
        <div>
          <h1 className="wren-admin-page-title type-display-m">System & Platform Settings</h1>
          <p className="wren-admin-page-desc type-meta">
            Global configurations governing branding, announcement broadcasts, and security throttles.
          </p>
        </div>
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

      <form onSubmit={handleSave} className="wren-admin-panel-card" style={{ padding: '2rem' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="type-meta">Loading platform parameters...</div>
          </div>
        ) : (
          <div className="wren-admin-form-stack">
            {/* Site Name */}
            <div className="wren-form-group">
              <label className="type-ui-m">Platform Name</label>
              <p className="type-meta">Visible across page headers and system notices.</p>
              <input
                type="text"
                required
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="wren-input"
                style={{ maxWidth: '420px' }}
              />
            </div>

            {/* Announcement Banner */}
            <div className="wren-form-group">
              <label className="type-ui-m">Editorial Announcement Banner</label>
              <p className="type-meta">
                Broadcast an official bulletin or dispatch to all readers across the platform. Leave empty to dismiss banner.
              </p>
              <textarea
                rows={3}
                value={settings.announcementBanner}
                onChange={(e) => setSettings({ ...settings, announcementBanner: e.target.value })}
                placeholder="e.g. Welcome to the inaugural release of our correspondence forum. Letters published today will be archived in the seasonal ledger."
                className="wren-textarea"
                style={{ maxWidth: '640px' }}
              />
            </div>

            {/* Default Density */}
            <div className="wren-form-group">
              <label className="type-ui-m">Default Reading Density</label>
              <p className="type-meta">Spacing scale applied to guest visitors before individual preference is chosen.</p>
              <select
                value={settings.defaultDensity}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    defaultDensity: e.target.value as 'comfortable' | 'compact',
                  })
                }
                className="wren-select"
                style={{ maxWidth: '360px' }}
              >
                <option value="comfortable">Comfortable (8px unit, 32px flow)</option>
                <option value="compact">Compact (6px unit, 20px flow)</option>
              </select>
            </div>

            {/* Max post length */}
            <div className="wren-form-group">
              <label className="type-ui-m">Max Prose Length (Characters)</label>
              <p className="type-meta">Upper bound for a single published letter or correspondence entry.</p>
              <input
                type="number"
                min={200}
                max={10000}
                value={settings.maxPostLength}
                onChange={(e) =>
                  setSettings({ ...settings, maxPostLength: parseInt(e.target.value || '2000') })
                }
                className="wren-input"
                style={{ maxWidth: '180px' }}
              />
            </div>

            {/* Rate limit max requests */}
            <div className="wren-form-group">
              <label className="type-ui-m">Rate Limiting Window Cap</label>
              <p className="type-meta">Maximum API dispatches allowed per IP window (15 minutes) before throttling.</p>
              <input
                type="number"
                min={20}
                max={1000}
                value={settings.rateLimitMaxRequests}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    rateLimitMaxRequests: parseInt(e.target.value || '100'),
                  })
                }
                className="wren-input"
                style={{ maxWidth: '180px' }}
              />
            </div>

            {/* Submit button */}
            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="submit"
                disabled={isSaving}
                className="wren-button wren-button--wine"
              >
                {isSaving ? 'Updating...' : 'Save Configuration'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default AdminSettings;
