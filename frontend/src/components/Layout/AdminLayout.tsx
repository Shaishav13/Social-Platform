import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon } from '../ui/Icon';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  // Persist sidebar state in localStorage, defaulting to true only on wide screens
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('wren_admin_sidebar_expanded');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 900; // collapsed by default on tablet/phone
  });

  const handleToggle = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('wren_admin_sidebar_expanded', String(next));
      return next;
    });
  };

  // Determine section name for breadcrumbs
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/admin') return 'Dashboard';
    if (path.startsWith('/admin/users')) return 'Users & Accounts';
    if (path.startsWith('/admin/features')) return 'Platform Features';
    if (path.startsWith('/admin/settings')) return 'System Settings';
    if (path.startsWith('/admin/moderation')) return 'Content Moderation';
    return 'Administration';
  };

  return (
    <div className="wren-admin-shell">
      <AdminSidebar isExpanded={isExpanded} onToggle={handleToggle} />

      <div className="wren-admin-content-area">
        {/* Top Header Bar */}
        <header className="wren-admin-topbar">
          <div className="wren-admin-topbar__left">
            <nav className="wren-admin-breadcrumbs" aria-label="Breadcrumb">
              <Link to="/admin" className="wren-admin-breadcrumbs__root">Admin</Link>
              <span className="wren-admin-breadcrumbs__sep">/</span>
              <span className="wren-admin-breadcrumbs__current">{getBreadcrumb()}</span>
            </nav>
          </div>

          <div className="wren-admin-topbar__right">
            {/* Hamburger toggle — visible on mobile (≤900px) */}
            <button
              type="button"
              onClick={handleToggle}
              className="wren-admin-action-btn wren-admin-hamburger"
              title="Toggle Sidebar"
              aria-label="Toggle Sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="wren-admin-action-btn"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Material`}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
            </button>

            {/* Admin identity badge */}
            <div className="wren-admin-badge-user">
              <span className="wren-admin-badge-user__indicator" />
              <span className="wren-admin-badge-user__name">@{user?.username || 'admin'}</span>
              <span className="wren-admin-badge-user__role">Curator</span>
            </div>
          </div>
        </header>

        {/* Main Content Stage */}
        <main className="wren-admin-main">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
