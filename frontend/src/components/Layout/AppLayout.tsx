import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { NavigationRail } from './NavigationRail';
import { MarginNotes } from './MarginNotes';
import { QuietTopBar } from './QuietTopBar';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useAuth();
  const { features, settings } = useConfig();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);

  // If maintenance mode is active and user is not an admin, display platform maintenance shield
  const isMaintenance = features.maintenanceMode && user?.role !== 'admin' && location.pathname !== '/login';

  if (isMaintenance) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--paper-100)',
          padding: '32px 20px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '520px',
            width: '100%',
            padding: '40px 32px',
            background: 'var(--paper-50)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛠️</div>
          <h1 className="type-display-l" style={{ margin: '0 0 12px', fontSize: '26px' }}>
            Under Scheduled Maintenance
          </h1>
          <p
            className="type-ui-m"
            style={{ color: 'var(--ink-600)', lineHeight: 1.6, marginBottom: '24px' }}
          >
            {settings.siteName || 'UdtaBirdie'} is currently undergoing scheduled platform improvements.
            All manuscripts, accounts, and correspondence remain secure. Please check back shortly.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <Link to="/login" className="wren-btn wren-btn-outline" style={{ fontSize: '13px' }}>
              Admin Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="wren-shell">
      {/* 56px Left Rail (Desktop) & Bottom Tab (Mobile) */}
      <NavigationRail />

      {/* Fluid Center / Workspace Area spanning entire remaining width */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, width: '100%' }}>
        {/* Editorial Announcement Banner */}
        {settings.announcementBanner && (
          <div
            style={{
              backgroundColor: 'var(--wine-50, #fdf2f4)',
              color: 'var(--wine-900, #5c1827)',
              borderBottom: '1px solid var(--wine-200, #f8ccd5)',
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              textAlign: 'center',
              zIndex: 30,
            }}
          >
            <span role="img" aria-label="Announcement">📢</span>
            <span>{settings.announcementBanner}</span>
          </div>
        )}

        <QuietTopBar />
        <main className="wren-flow" role="main">
          {children}
        </main>
      </div>

      {/* Margin Notes Context on wide viewports (hidden on focused auth pages) */}
      {!isAuthPage && <MarginNotes />}
    </div>
  );
};

export default AppLayout;
