import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';

interface AdminSidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
}

interface NavItem {
  to: string;
  icon: IconName;
  label: string;
  badge?: string;
  end?: boolean;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ isExpanded, onToggle }) => {
  const navItems: NavItem[] = [
    { to: '/admin', icon: 'dashboard', label: 'Dashboard', end: true },
    { to: '/admin/users', icon: 'users', label: 'Users' },
    { to: '/admin/features', icon: 'features', label: 'Features' },
    { to: '/admin/settings', icon: 'settings', label: 'Settings' },
    { to: '/admin/moderation', icon: 'shield', label: 'Moderation' },
  ];

  return (
    <aside
      className={`wren-admin-sidebar ${isExpanded ? 'wren-admin-sidebar--expanded' : 'wren-admin-sidebar--collapsed'}`}
      aria-label="Administration Navigation"
    >
      {/* Brand & Logo Header */}
      <div className="wren-admin-sidebar__header">
        <Link to="/admin" className="wren-admin-sidebar__brand">
          <img
            src="/logo2.png"
            alt="UdtaBirdie"
            style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '4px', flexShrink: 0 }}
          />
          {isExpanded && (
            <div className="wren-admin-sidebar__brand-text">
              <span className="wren-admin-sidebar__title">UdtaBirdie</span>
              <span className="wren-admin-sidebar__subtitle">Admin Workstation</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation items */}
      <nav className="wren-admin-sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `wren-admin-sidebar__item ${isActive ? 'wren-admin-sidebar__item--active' : ''}`
            }
            title={!isExpanded ? item.label : undefined}
          >
            <span className="wren-admin-sidebar__icon-wrap">
              <Icon name={item.icon} size={18} />
            </span>
            {isExpanded && (
              <span className="wren-admin-sidebar__label">{item.label}</span>
            )}
            {isExpanded && item.badge && (
              <span className="wren-admin-sidebar__badge">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer / Utilities */}
      <div className="wren-admin-sidebar__footer">
        <Link
          to="/feed"
          className="wren-admin-sidebar__item wren-admin-sidebar__item--exit"
          title={!isExpanded ? 'Return to Feed' : undefined}
        >
          <span className="wren-admin-sidebar__icon-wrap">
            <Icon name="back" size={18} />
          </span>
          {isExpanded && <span className="wren-admin-sidebar__label">Public Platform</span>}
        </Link>

        <button
          type="button"
          onClick={onToggle}
          className="wren-admin-sidebar__toggle"
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <Icon name={isExpanded ? 'chevron-left' : 'chevron-right'} size={18} />
          {isExpanded && <span className="wren-admin-sidebar__toggle-text">Collapse Rail</span>}
        </button>
      </div>
    </aside>
  );
};

export default AdminSidebar;
