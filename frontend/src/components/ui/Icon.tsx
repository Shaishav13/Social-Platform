import React from 'react';

export type IconName =
  | 'home'
  | 'search'
  | 'compose'
  | 'notification'
  | 'profile'
  | 'like'
  | 'reply'
  | 'repost'
  | 'save'
  | 'sun'
  | 'moon'
  | 'density'
  | 'logout'
  | 'back'
  | 'more'
  | 'close'
  | 'check'
  | 'edit'
  | 'trash'
  | 'image'
  | 'dashboard'
  | 'users'
  | 'settings'
  | 'features'
  | 'shield'
  | 'chevron-left'
  | 'chevron-right'
  | 'plus'
  | 'filter'
  | 'lock'
  | 'unlock';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  isFilled?: boolean;
  className?: string;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  isFilled = false,
  className = '',
  ...props
}) => {
  const strokeWidth = 1.75;

  const renderPath = () => {
    switch (name) {
      case 'home':
        return isFilled ? (
          <path d="M3 10.5L12 3l9 7.5v9.5a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9.5z" fill="currentColor" />
        ) : (
          <path
            d="M3 10.5L12 3l9 7.5v9.5a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'search':
        return (
          <path
            d="M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zm6-1.5L21 21"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'compose':
        return (
          <path
            d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'notification':
        return isFilled ? (
          <path
            d="M12 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 005 15h14a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zm-3 16a3 3 0 006 0H9z"
            fill="currentColor"
          />
        ) : (
          <>
            <path
              d="M18 11.586V8a6 6 0 10-12 0v3.586L4.293 13.293A1 1 0 005 15h14a1 1 0 00.707-1.707L18 11.586z"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 18a3 3 0 006 0"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'profile':
        return isFilled ? (
          <path
            d="M12 12a5 5 0 100-10 5 5 0 000 10zm-7 8a7 7 0 0114 0H5z"
            fill="currentColor"
          />
        ) : (
          <>
            <circle
              cx="12"
              cy="7"
              r="4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4.5 20.5a7.5 7.5 0 0115 0"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'like':
        return isFilled ? (
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="currentColor"
          />
        ) : (
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'reply':
        return (
          <path
            d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.13-3.39A7.935 7.935 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'repost':
        return (
          <path
            d="M4 12v-2a4 4 0 014-4h11m0 0l-3-3m3 3l-3 3M20 12v2a4 4 0 01-4 4H5m0 0l3 3m-3-3l3-3"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'save':
        return isFilled ? (
          <path d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z" fill="currentColor" />
        ) : (
          <path
            d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'sun':
        return (
          <>
            <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <path
              d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />
          </>
        );

      case 'moon':
        return (
          <path
            d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'density':
        return (
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );

      case 'logout':
        return (
          <path
            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4m7 14l5-5-5-5m5 5H9"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'back':
        return (
          <path
            d="M19 12H5m7-7l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'more':
        return (
          <>
            <circle cx="5" cy="12" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="19" cy="12" r="1.5" fill="currentColor" />
          </>
        );

      case 'close':
        return (
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'check':
        return (
          <path
            d="M20 6L9 17l-5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'edit':
        return (
          <path
            d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.5-9.5a2.121 2.121 0 113 3L11 15l-4 1 1-4 9.5-9.5z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'trash':
        return (
          <path
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'image':
        return (
          <>
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
            />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
            <path
              d="M21 15l-5-5L5 21"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'dashboard':
        return (
          <>
            <rect x="3" y="3" width="7" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <rect x="14" y="3" width="7" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <rect x="14" y="12" width="7" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <rect x="3" y="16" width="7" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
          </>
        );

      case 'users':
        return (
          <>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="9" cy="7" r="4" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M23 21v-2a4 4 0 00-3-3.87" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M16 3.13a4 4 0 010 7.75" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'settings':
        return (
          <>
            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <path
              d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        );

      case 'features':
        return (
          <>
            <rect x="2" y="6" width="20" height="12" rx="6" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <circle cx="16" cy="12" r="3" fill="currentColor" />
          </>
        );

      case 'shield':
        return (
          <path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'chevron-left':
        return (
          <path
            d="M15 18l-6-6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'chevron-right':
        return (
          <path
            d="M9 18l6-6-6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'plus':
        return (
          <path
            d="M12 5v14m-7-7h14"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'filter':
        return (
          <path
            d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );

      case 'lock':
        return (
          <>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M7 11V7a5 5 0 0110 0v4" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      case 'unlock':
        return (
          <>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" fill="none" stroke="currentColor" strokeWidth={strokeWidth} />
            <path d="M7 11V7a5 5 0 019.9-1" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`wren-icon ${className}`}
      aria-hidden="true"
      {...props}
    >
      {renderPath()}
    </svg>
  );
};
