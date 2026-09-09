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

  // Persist sidebar state in localStorage, defaulting to true on wide screens
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('wren_admin_sidebar_expanded');
    return saved !== null ? saved === 'true' : window.innerWidth >= 1200;
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
