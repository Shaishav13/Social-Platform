import React from 'react';
import { Link } from 'react-router-dom';

interface RichTextProps {
  text: string;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Renders text with clickable @mentions and #hashtags.
 * @mention → /search?q=username&type=users
 * #hashtag → /explore?tag=hashtag
 */
export const RichText: React.FC<RichTextProps> = ({ text, style, className }) => {
  if (!text) return null;

  // Split on @mention and #hashtag tokens (kept as separate parts by the capture group)
  const tokenPattern = /(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_]+)/g;
  const parts = text.split(tokenPattern);

  return (
    <span style={style} className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1) {
          const username = part.slice(1);
          return (
            <Link
              key={i}
              to={`/profile/${encodeURIComponent(username)}`}
              style={{
                color: 'var(--wine-600, #9b2d42)',
                fontWeight: 700,
                textDecoration: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }

        if (part.startsWith('#') && part.length > 1) {
          const tag = part.slice(1);
          return (
            <Link
              key={i}
              to={`/explore?tag=${encodeURIComponent(tag)}`}
              style={{
                color: 'var(--wine-600, #9b2d42)',
                fontWeight: 600,
                textDecoration: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }

        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </span>
  );
};

export default RichText;
