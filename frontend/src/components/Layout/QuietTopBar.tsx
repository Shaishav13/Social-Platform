import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../ui';
import api from '../../services/api';

export const QuietTopBar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { settings } = useConfig();
  const { isAuthenticated } = useAuth();
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

  return (
    <header className="wren-mobile-top" role="banner">
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        <img
          src="/logo2.png"
          alt={settings.siteName || 'UdtaBirdie'}
          style={{ width: '24px', height: '24px', objectFit: 'contain', borderRadius: '3px' }}
        />
        <span className="type-display-m" style={{ fontSize: '18px', fontWeight: 600 }}>
          {settings.siteName || 'UdtaBirdie'}
        </span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={toggleTheme}
          style={{ background: 'none', border: 'none', color: 'var(--ink-600)', padding: '6px' }}
          aria-label="Toggle Theme"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
        </button>
        {isAuthenticated && (
          <Link
            to="/notifications"
            style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-600)', padding: '6px' }}
            aria-label="Notifications"
          >
            <Icon name="notification" size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--ochre-600)',
                }}
              />
            )}
          </Link>
        )}
      </div>
    </header>
  );
};
