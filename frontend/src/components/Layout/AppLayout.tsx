import React from 'react';
import { useLocation } from 'react-router-dom';
import { NavigationRail } from './NavigationRail';
import { MarginNotes } from './MarginNotes';
import { QuietTopBar } from './QuietTopBar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname);

  return (
    <div className="wren-shell">
      {/* 56px Left Rail (Desktop) & Bottom Tab (Mobile) */}
      <NavigationRail />

      {/* Fluid Center / Workspace Area spanning entire remaining width */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, width: '100%' }}>
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
