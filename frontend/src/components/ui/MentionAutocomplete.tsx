import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { resolveMediaUrl } from '../../utils/media';

export interface UserMention {
  id: string;
  username: string;
  bio?: string;
  profilePicture?: string;
  isVerified?: boolean;
}

export function useMentionAutocomplete(
  text: string,
  setText: (newText: string) => void,
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>
) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<UserMention[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [atIndex, setAtIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);

  // Detect mention trigger on text change or keypress
  const checkForMention = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? text.length;
    const textBeforeCursor = text.slice(0, cursor);

    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt === -1) {
      setIsOpen(false);
      return;
    }

    // Must be preceded by space or start of line
    if (lastAt > 0 && !/\s/.test(textBeforeCursor[lastAt - 1])) {
      setIsOpen(false);
      return;
    }

    const potentialQuery = textBeforeCursor.slice(lastAt + 1);
    // If any whitespace between @ and cursor, it's not active mention
    if (/\s/.test(potentialQuery)) {
      setIsOpen(false);
      return;
    }

    setAtIndex(lastAt);
    setQuery(potentialQuery);
    setIsOpen(true);
  }, [text, inputRef]);

  // Debounced user search
  useEffect(() => {
    if (!isOpen) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/search/users?q=${encodeURIComponent(query)}&limit=6`);
        const users: UserMention[] = res.data?.users || [];
        setSuggestions(users);
        setActiveIndex(0);
      } catch (err) {
        console.error('Mention user search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  const selectUser = useCallback((username: string) => {
    const el = inputRef.current;
    if (!el || atIndex === -1) return;

    const cursor = el.selectionStart ?? text.length;
    const before = text.slice(0, atIndex);
    const after = text.slice(cursor);
    const insertion = `@${username} `;
    const updated = before + insertion + after;

    setText(updated);
    setIsOpen(false);

    setTimeout(() => {
      el.focus();
      const nextPos = before.length + insertion.length;
      el.setSelectionRange(nextPos, nextPos);
    }, 10);
  }, [text, setText, atIndex, inputRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (!isOpen || suggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % suggestions.length);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (suggestions[activeIndex]) {
        selectUser(suggestions[activeIndex].username);
      }
      return true;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return true;
    }
    return false;
  }, [isOpen, suggestions, activeIndex, selectUser]);

  return {
    isOpen: isOpen && (suggestions.length > 0 || isLoading),
    suggestions,
    activeIndex,
    isLoading,
    checkForMention,
    handleKeyDown,
    selectUser,
    close: () => setIsOpen(false),
  };
}

interface MentionDropdownProps {
  isOpen: boolean;
  suggestions: UserMention[];
  activeIndex: number;
  isLoading?: boolean;
  onSelect: (username: string) => void;
  style?: React.CSSProperties;
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  isOpen,
  suggestions,
  activeIndex,
  isLoading,
  onSelect,
  style,
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label="User mention suggestions"
      style={{
        position: 'absolute',
        zIndex: 1000,
        backgroundColor: 'var(--paper-100, #FDFCFA)',
        border: '1px solid var(--border, #E6E1DA)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(28, 26, 24, 0.12)',
        width: '260px',
        maxHeight: '230px',
        overflowY: 'auto',
        padding: '4px',
        ...style,
      }}
    >
      <div
        style={{
          padding: '6px 10px 4px 10px',
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--ink-500, #8A8580)',
          fontFamily: 'var(--font-sans, sans-serif)',
          borderBottom: '1px solid var(--border-light, #F0ECE6)',
          marginBottom: '2px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Tag a friend</span>
        {isLoading && <span style={{ fontSize: '10px', fontWeight: 500 }}>Searching...</span>}
      </div>

      {suggestions.length === 0 && isLoading ? (
        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--ink-500)', textAlign: 'center' }}>
          Finding users...
        </div>
      ) : suggestions.length === 0 ? (
        <div style={{ padding: '12px', fontSize: '13px', color: 'var(--ink-500)', textAlign: 'center' }}>
          No matching users
        </div>
      ) : (
        suggestions.map((user, idx) => {
          const isSelected = idx === activeIndex;
          return (
            <div
              key={user.id}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => {
                // onMouseDown instead of onClick to prevent input blur before select
                e.preventDefault();
                onSelect(user.username);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: isSelected ? 'var(--paper-300, #ECE7E0)' : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
            >
              {user.profilePicture ? (
                <img
                  src={resolveMediaUrl(user.profilePicture)}
                  alt={user.username}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--wine-900, #4A1525)',
                    color: '#FAF8F5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--ink-900, #1C1A18)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    @{user.username}
                  </span>
                  {user.isVerified && (
                    <span style={{ color: '#007aff', fontSize: '12px' }} title="Verified">
                      ✓
                    </span>
                  )}
                </div>
                {user.bio && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: 'var(--ink-500, #8A8580)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {user.bio}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};
