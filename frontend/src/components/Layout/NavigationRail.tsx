import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Icon, Badge } from '../ui';
import api from '../../services/api';

export const NavigationRail: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { theme, density, toggleTheme, toggleDensity } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      loadUnreadCount();
      const interval = setInterval(loadUnreadCount, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const loadUnreadCount = async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(response.data.unreadCount || 0);
    } catch {
      // quiet fallback
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = isAuthenticated
    ? [
        { path: '/feed', label: 'Feed', icon: 'home' as const },
        { path: '/explore', label: 'Explore', icon: 'search' as const },
        { path: '/create-post', label: 'Compose', icon: 'compose' as const },
        {
          path: '/notifications',
          label: 'Notifications',
          icon: 'notification' as const,
          badge: unreadCount,
        },
        {
          path: user?.id ? `/profile/${user.id}` : '/login',
          label: 'Profile',
          icon: 'profile' as const,
        },
        {
          path: '/settings',
          label: 'Settings',
          icon: 'settings' as const,
        },
        ...(user?.role === 'admin'
          ? [
              {
                path: '/admin',
                label: 'Admin Portal',
                icon: 'dashboard' as const,
              },
            ]
          : []),
      ]
    : [
        { path: '/login', label: 'Login', icon: 'profile' as const },
        { path: '/explore', label: 'Explore', icon: 'search' as const },
      ];

  // Expandable rail state (persisted in localStorage)
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const saved = localStorage.getItem('wren_user_sidebar_expanded');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleExpanded = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      localStorage.setItem('wren_user_sidebar_expanded', String(next));
      return next;
    });
  };

  return (
    <>
      {/* Desktop Navigation Rail (56px collapsed or 230px expanded) */}
      <nav
        className={`wren-rail ${isExpanded ? 'wren-rail--expanded' : 'wren-rail--collapsed'}`}
        role="navigation"
        aria-label="Primary Navigation"
      >
        {!isExpanded ? (
          <>
            {/* Collapsed Logo */}
            <NavLink to="/" className="wren-rail-brand" title="UdtaBirdie" aria-label="UdtaBirdie Home">
              <img
                src="/logo2.png"
                alt="UdtaBirdie"
                style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px' }}
              />
            </NavLink>

            {/* Collapsed Nav Items */}
            <div className="wren-rail-nav">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `wren-rail-item ${isActive ? 'active' : ''}`
                    }
                    title={item.label}
                    aria-label={item.label}
                  >
                    <Icon name={item.icon} size={20} isFilled={isActive} />
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge
                        count={item.badge}
                        className="wren-rail-badge"
                        label={`${item.badge} notifications`}
                      />
                    )}
                  </NavLink>
                );
              })}
            </div>

            {/* Collapsed Footer */}
            <div className="wren-rail-footer">
              <button
                type="button"
                onClick={toggleTheme}
                className="wren-rail-item"
                title={theme === 'dark' ? 'Switch to Paper mode' : 'Switch to Dark Paper'}
                aria-label="Toggle Theme"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
              </button>

              <button
                type="button"
                onClick={toggleDensity}
                className="wren-rail-item"
                title={`Density: ${density}`}
                aria-label={`Toggle Density (currently ${density})`}
              >
                <Icon name="density" size={18} />
              </button>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="wren-rail-item"
                  title="Log out"
                  aria-label="Log out"
                >
                  <Icon name="logout" size={18} />
                </button>
              )}

              <button
                type="button"
                onClick={toggleExpanded}
                className="wren-rail-item"
                title="Expand Sidebar"
                aria-label="Expand Sidebar"
              >
                <Icon name="chevron-right" size={18} />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Expanded Header with Brand Logo */}
            <div className="wren-rail-header-expanded">
              <NavLink to="/" className="wren-rail-brand-expanded">
                <img
                  src="/logo2.png"
                  alt="UdtaBirdie"
                  style={{ width: '34px', height: '34px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
                />
                <div className="wren-rail-brand-text">
                  <span
                    className="type-display-m"
                    style={{ fontSize: '1.1rem', fontWeight: 600, lineHeight: 1.1, color: 'var(--ink-900)' }}
                  >
                    UdtaBirdie
                  </span>
                  <span
                    className="type-meta"
                    style={{ fontSize: '0.65rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
                  >
                    Connect & Share
                  </span>
                </div>
              </NavLink>
            </div>

            {/* Expanded Nav Items with Text Labels */}
            <div className="wren-rail-nav-expanded">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `wren-rail-item-expanded ${isActive ? 'active' : ''}`
                    }
                  >
                    <span className="wren-rail-item-icon">
                      <Icon name={item.icon} size={19} isFilled={isActive} />
                    </span>
                    <span className="wren-rail-item-label type-ui-m">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge
                        count={item.badge}
                        className="wren-rail-badge-expanded"
                        label={`${item.badge} notifications`}
                      />
                    )}
                  </NavLink>
                );
              })}
            </div>

            {/* Expanded Footer with Actions & Collapse Button */}
            <div className="wren-rail-footer-expanded">
              <button
                type="button"
                onClick={toggleTheme}
                className="wren-rail-footer-btn"
                title={`Switch to ${theme === 'dark' ? 'Paper' : 'Dark Paper'}`}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
                <span>{theme === 'dark' ? 'Light Paper' : 'Dark Paper'}</span>
              </button>

              <button
                type="button"
                onClick={toggleDensity}
                className="wren-rail-footer-btn"
                title={`Density: ${density}`}
              >
                <Icon name="density" size={17} />
                <span>Density: {density === 'compact' ? 'Compact' : 'Comfortable'}</span>
              </button>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="wren-rail-footer-btn"
                  title="Sign Out"
                >
                  <Icon name="logout" size={17} />
                  <span>Sign Out</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleExpanded}
                className="wren-rail-collapse-btn"
                aria-label="Collapse Rail"
              >
                <Icon name="chevron-left" size={17} />
                <span>Collapse Rail</span>
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Mobile Bottom Navigation Bar (<720px) */}
      <nav className="wren-mobile-bottom" role="navigation" aria-label="Mobile Navigation">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `wren-tab-item ${isActive ? 'active' : ''}`
              }
              aria-label={item.label}
            >
              <Icon name={item.icon} size={22} isFilled={isActive} />
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 8,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: 'var(--ochre-600)',
                  }}
                  aria-hidden="true"
                />
              )}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};
