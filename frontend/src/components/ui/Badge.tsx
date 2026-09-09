import React from 'react';

interface BadgeProps {
  count?: number;
  label?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ count, label, className = '' }) => {
  if (count === undefined || count <= 0) return null;

  const displayCount = count > 9 ? '9+' : count.toString();

  return (
    <span
      className={`wren-badge-ochre ${className}`}
      role="status"
      aria-label={label || `${count} unread notifications`}
    >
      {displayCount}
    </span>
  );
};
