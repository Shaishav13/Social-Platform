import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useConfig } from '../../contexts/ConfigContext';
import { Icon } from '../ui';

export const QuietTopBar: React.FC = () => {
  const { theme, toggleTheme, toggleDensity } = useTheme();
  const { settings } = useConfig();

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
        <button
          onClick={toggleDensity}
          style={{ background: 'none', border: 'none', color: 'var(--ink-600)', padding: '6px' }}
          aria-label="Toggle Spacing Density"
        >
          <Icon name="density" size={18} />
        </button>
      </div>
    </header>
  );
};
