import React, { useState, useEffect, useCallback } from 'react';
import { resolveMediaUrl } from '../../utils/media';

export interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mediaUrls: string[];
  initialIndex?: number;
  authorName?: string;
  authorUsername?: string;
  caption?: string;
}

const isVideoUrl = (url: string): boolean => {
  return Boolean(url && url.match(/\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i));
};

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  mediaUrls = [],
  initialIndex = 0,
  authorName,
  authorUsername,
  caption,
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(initialIndex);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  // Sync initialIndex when modal opens or index prop changes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, mediaUrls.length - 1)));
      setIsZoomed(false);
    }
  }, [isOpen, initialIndex, mediaUrls.length]);

  // Lock body scroll while viewer is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const total = mediaUrls.length;
  const hasMultiple = total > 1;

  const goToPrevious = useCallback(() => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  const goToNext = useCallback(() => {
    setIsZoomed(false);
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  // Keyboard navigation: Left/Right arrows and Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        goToPrevious();
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasMultiple, goToPrevious, goToNext, onClose]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || !hasMultiple) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (diff > 50) {
      // Swiped left -> next
      goToNext();
    } else if (diff < -50) {
      // Swiped right -> previous
      goToPrevious();
    }
    setTouchStartX(null);
  };

  if (!isOpen || total === 0) return null;

  const currentUrl = mediaUrls[currentIndex] || '';
  const isVideo = isVideoUrl(currentUrl);
  const resolvedUrl = resolveMediaUrl(currentUrl);

  return (
    <div
      className="wren-media-viewer-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo and Video Viewer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(12, 11, 10, 0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        animation: 'wrenFadeIn 180ms ease-out',
        userSelect: 'none',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          zIndex: 10,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}
      >
        {/* Author / Post Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          {authorUsername && (
            <div style={{ color: '#FAF8F5', fontSize: '14px', fontFamily: 'var(--font-sans)' }}>
              <span style={{ fontWeight: 600 }}>{authorName || authorUsername}</span>
              <span style={{ color: 'rgba(250, 248, 245, 0.65)', marginLeft: '6px' }}>
                @{authorUsername}
              </span>
            </div>
          )}
        </div>

        {/* Counter Badge (if multiple media) */}
        {hasMultiple && (
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              padding: '4px 14px',
              color: '#FAF8F5',
              fontSize: '13px',
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>{currentIndex + 1} / {total}</span>
          </div>
        )}

        {/* Actions (Zoom, Open Tab, Close) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!isVideo && (
            <button
              type="button"
              onClick={() => setIsZoomed(!isZoomed)}
              title={isZoomed ? 'Zoom Out' : 'Zoom In'}
              aria-label={isZoomed ? 'Zoom Out' : 'Zoom In'}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#FAF8F5',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isZoomed ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              )}
            </button>
          )}

          <a
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open original file"
            aria-label="Open original file"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              color: '#FAF8F5',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>

          <button
            type="button"
            onClick={onClose}
            title="Close viewer (Esc)"
            aria-label="Close viewer"
            style={{
              background: 'rgba(255, 255, 255, 0.14)',
              border: '1px solid rgba(255, 255, 255, 0.22)',
              color: '#FAF8F5',
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              transition: 'all 0.15s ease',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Stage: Center Media & Side Navigation Arrows */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          padding: '10px 20px',
        }}
      >
        {/* Left Arrow (Previous) */}
        {hasMultiple && (
          <button
            type="button"
            className="wren-media-nav-btn"
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            title="Previous (Left Arrow)"
            aria-label="Previous Media"
            style={{
              position: 'absolute',
              left: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(28, 26, 24, 0.75)',
              border: '1.5px solid rgba(255, 255, 255, 0.22)',
              color: '#FAF8F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        )}

        {/* Center Media Container */}
        <div
          className="wren-media-viewer-content"
          onClick={(e) => e.stopPropagation()}
          style={{
            maxWidth: isZoomed ? '98vw' : '90vw',
            maxHeight: isZoomed ? '95vh' : '82vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.25s cubic-bezier(0.2, 0, 0, 1)',
            transform: isZoomed ? 'scale(1.35)' : 'scale(1)',
            cursor: isVideo ? 'default' : isZoomed ? 'zoom-out' : 'zoom-in',
          }}
          onClickCapture={() => !isVideo && setIsZoomed(!isZoomed)}
        >
          {isVideo ? (
            <video
              key={resolvedUrl}
              src={resolvedUrl}
              controls
              autoPlay
              playsInline
              style={{
                maxWidth: '90vw',
                maxHeight: '80vh',
                borderRadius: '6px',
                boxShadow: '0 12px 48px rgba(0,0,0,0.65)',
                outline: 'none',
                backgroundColor: '#000',
              }}
            />
          ) : (
            <img
              key={resolvedUrl}
              src={resolvedUrl}
              alt={`Full size attachment ${currentIndex + 1}`}
              style={{
                maxWidth: '90vw',
                maxHeight: '82vh',
                objectFit: 'contain',
                borderRadius: '6px',
                boxShadow: '0 12px 48px rgba(0,0,0,0.65)',
                transition: 'opacity 0.2s ease',
              }}
              loading="eager"
            />
          )}
        </div>

        {/* Right Arrow (Next) */}
        {hasMultiple && (
          <button
            type="button"
            className="wren-media-nav-btn"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            title="Next (Right Arrow)"
            aria-label="Next Media"
            style={{
              position: 'absolute',
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 20,
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'rgba(28, 26, 24, 0.75)',
              border: '1.5px solid rgba(255, 255, 255, 0.22)',
              color: '#FAF8F5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom Bar: Post Caption snippet & Interactive Media Thumbnails */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          padding: '14px 24px 20px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          zIndex: 10,
        }}
      >
        {caption && (
          <div
            style={{
              maxWidth: '680px',
              color: 'rgba(250, 248, 245, 0.88)',
              fontFamily: 'var(--font-serif)',
              fontSize: '14.5px',
              lineHeight: 1.45,
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            "{caption}"
          </div>
        )}

        {/* Thumbnail Preview Strip */}
        {hasMultiple && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              overflowX: 'auto',
              maxWidth: '90vw',
              padding: '4px',
            }}
          >
            {mediaUrls.map((url, idx) => {
              const active = idx === currentIndex;
              const thumbIsVideo = isVideoUrl(url);
              const thumbUrl = resolveMediaUrl(url);

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsZoomed(false);
                    setCurrentIndex(idx);
                  }}
                  title={`View media ${idx + 1}`}
                  style={{
                    position: 'relative',
                    width: '46px',
                    height: '46px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    padding: 0,
                    border: active
                      ? '2px solid var(--wine-700, #9A3B5A)'
                      : '1.5px solid rgba(255, 255, 255, 0.25)',
                    backgroundColor: '#1C1A18',
                    cursor: 'pointer',
                    opacity: active ? 1 : 0.6,
                    transform: active ? 'scale(1.08)' : 'scale(1)',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 0 10px rgba(154, 59, 90, 0.6)' : 'none',
                  }}
                >
                  {thumbIsVideo ? (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#1E1B18',
                        color: '#FAF8F5',
                        fontSize: '12px',
                      }}
                    >
                      ▶
                    </div>
                  ) : (
                    <img
                      src={thumbUrl}
                      alt={`Thumbnail ${idx + 1}`}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaViewerModal;
