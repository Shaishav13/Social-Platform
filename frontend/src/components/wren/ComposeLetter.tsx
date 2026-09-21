import React, { useState, useRef } from 'react';
import { Icon, Button, useMentionAutocomplete, MentionDropdown } from '../ui';
import { useConfig } from '../../contexts/ConfigContext';
import api from '../../services/api';

interface ComposeLetterProps {
  onPostCreated?: () => void;
  placeholder?: string;
  isStandalone?: boolean;
}

export const ComposeLetter: React.FC<ComposeLetterProps> = ({
  onPostCreated,
  placeholder = 'Write a letter, essay, or thought...',
  isStandalone = false,
}) => {
  const { features, settings } = useConfig();
  const maxLen = settings.maxPostLength || 2000;
  const [content, setContent] = useState('');
  const [allowReposts, setAllowReposts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; previewUrl: string; isVideo: boolean }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isOpen: isMentionOpen,
    suggestions: mentionSuggestions,
    activeIndex: mentionActiveIndex,
    isLoading: isMentionLoading,
    checkForMention,
    handleKeyDown: handleMentionKeyDown,
    selectUser: selectMentionUser,
  } = useMentionAutocomplete(content, setContent, textareaRef);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!features.mediaUploads) {
      setError('Manuscript media attachments are currently paused by platform administrators.');
      return;
    }
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedFiles.length + files.length > 5) {
      setError('You can attach a maximum of 5 photos or videos per letter.');
      return;
    }

    const newAttachments: { file: File; previewUrl: string; isVideo: boolean }[] = [];
    for (const file of files) {
      const isVideo = file.type.startsWith('video/') || Boolean(file.name.match(/\.(mp4|webm|mov|m4v)$/i));
      const limitMB = isVideo ? 20 : 5;
      const limitBytes = limitMB * 1024 * 1024;
      
      if (file.size > limitBytes) {
        setError(`"${file.name}" exceeds the ${limitMB}MB size limit.`);
        return;
      }
      
      newAttachments.push({
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo,
      });
    }

    setSelectedFiles((prev) => [...prev, ...newAttachments]);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearAllFiles = () => {
    selectedFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && selectedFiles.length === 0) return;

    if (content.length > maxLen) {
      setError(`Your letter exceeds the maximum prose limit of ${maxLen} characters.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');

      let mediaIds: string[] = [];

      // If files attached, upload all together
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((item) => {
          formData.append('media', item.file);
        });

        const uploadRes = await api.post('/content/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // Extract media IDs from upload response — the backend create-post endpoint
        // requires mediaIds (DB record IDs), not URL strings
        const uploads: any[] = uploadRes.data?.uploads || uploadRes.data?.media || [];
        if (uploads.length > 0) {
          mediaIds = uploads.map((u: any) => u.id).filter(Boolean);
        }

        // Fallback: if no IDs (unexpected response shape), warn in console
        if (mediaIds.length === 0) {
          console.warn('[Upload] No media IDs returned from upload endpoint:', uploadRes.data);
        }
      }

      await api.post('/content/posts', {
        content: content.trim(),
        mediaIds,
        allowReposts,
      });

      setContent('');
      setAllowReposts(false);
      clearAllFiles();
      onPostCreated?.();
    } catch (err: any) {
      console.error('Failed to post:', err);
      setError(err.response?.data?.message || 'Failed to send your letter. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasContent = content.trim().length > 0 || selectedFiles.length > 0;

  return (
    <form className={`wren-compose ${isStandalone ? 'standalone' : ''}`} onSubmit={handleSubmit} aria-label="Compose post" style={isStandalone ? { padding: 0, border: 'none', margin: 0 } : undefined}>
      {error && <div className="wren-error" role="alert" style={{ marginBottom: '12px' }}>{error}</div>}

      <div style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          className="wren-compose-input"
          placeholder={placeholder}
          value={content}
          onChange={e => {
            setContent(e.target.value);
            checkForMention();
          }}
          onKeyUp={checkForMention}
          onClick={checkForMention}
          onKeyDown={e => {
            if (handleMentionKeyDown(e)) return;
          }}
          rows={isStandalone ? 8 : 2}
          style={isStandalone ? { minHeight: '300px', fontSize: '18px', padding: '24px', backgroundColor: 'transparent', border: 'none', boxShadow: 'none' } : undefined}
          aria-label="Write a letter or post"
        />

        <MentionDropdown
          isOpen={isMentionOpen}
          suggestions={mentionSuggestions}
          activeIndex={mentionActiveIndex}
          isLoading={isMentionLoading}
          onSelect={selectMentionUser}
          style={{ top: '100%', left: 0 }}
        />
      </div>

      {/* Multiple Media attachment preview strip */}
      {selectedFiles.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: 'var(--ink-500)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
              {selectedFiles.length} {selectedFiles.length === 1 ? 'file attached' : 'files attached (max 5)'}
            </span>
            <button
              type="button"
              onClick={clearAllFiles}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--rust-alert, #A63D40)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '2px 6px',
                textDecoration: 'underline',
              }}
            >
              Remove all
            </button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: selectedFiles.length === 1 ? '1fr' : 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: '10px',
            }}
          >
            {selectedFiles.map((item, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-sm, 4px)',
                  overflow: 'hidden',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--paper-200)',
                  height: selectedFiles.length === 1 ? '220px' : '110px',
                }}
              >
                {item.isVideo ? (
                  <video
                    src={item.previewUrl}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    muted
                  />
                ) : (
                  <img
                    src={item.previewUrl}
                    alt={`Attachment preview ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}

                {item.isVideo && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      left: '6px',
                      backgroundColor: 'rgba(0,0,0,0.65)',
                      color: '#fff',
                      fontSize: '10px',
                      padding: '2px 5px',
                      borderRadius: '3px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                    }}
                  >
                    ▶ Video
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  title="Remove attachment"
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    background: 'rgba(28, 26, 24, 0.75)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: '#FAF8F5',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                  }}
                  aria-label={`Remove media ${idx + 1}`}
                >
                  <Icon name="close" size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="wren-compose-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {features.mediaUploads ? (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                style={{ display: 'none' }}
                id="wren-file-upload"
              />
              <label
                htmlFor="wren-file-upload"
                className="wren-btn wren-btn-outline"
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px' }}
                title="Attach images or videos (up to 5)"
                aria-label="Attach media"
              >
                <Icon name="image" size={16} />
                <span style={{ fontSize: '13px', fontWeight: 500 }}>Photos & Videos</span>
              </label>
            </>
          ) : (
            <span
              style={{
                fontSize: '12px',
                color: 'var(--ink-400)',
                fontStyle: 'italic',
                padding: '4px 8px',
              }}
              title="Media uploads are paused by administration"
            >
              Imagery disabled
            </span>
          )}

          {/* Allow Reposts toggle checkbox */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '12.5px',
              color: allowReposts ? 'var(--moss, #2e7d32)' : 'var(--ink-600, #57534E)',
              userSelect: 'none',
              fontFamily: 'var(--font-sans, sans-serif)',
              fontWeight: allowReposts ? 600 : 500,
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: allowReposts ? 'rgba(46, 125, 50, 0.08)' : 'transparent',
              border: allowReposts ? '1px solid rgba(46, 125, 50, 0.25)' : '1px solid transparent',
              transition: 'all 0.15s ease',
              marginLeft: '4px',
            }}
            title="Allow other readers to repost this letter"
          >
            <input
              type="checkbox"
              checked={allowReposts}
              onChange={(e) => setAllowReposts(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--moss, #2e7d32)' }}
            />
            <Icon name="repost" size={14} style={{ color: allowReposts ? 'var(--moss, #2e7d32)' : 'var(--ink-500)' }} />
            <span>Allow Reposting</span>
          </label>

          {/* Character counter */}
          {content.length > 0 && (
            <span
              style={{
                fontSize: '12px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                color: content.length > maxLen ? 'var(--rust-alert, #A63D40)' : 'var(--ink-400)',
                marginLeft: '8px',
              }}
            >
              {content.length}/{maxLen}
            </span>
          )}
        </div>

        {/* Send button fades in only when text exists (absent when empty) */}
        <div className={`wren-compose-btn ${hasContent || isStandalone ? 'is-visible' : ''}`} style={isStandalone ? { opacity: 1, pointerEvents: 'auto', transform: 'none' } : undefined}>
          <Button
            type="submit"
            variant="primary"
            disabled={!hasContent || isSubmitting || content.length > maxLen}
            isLoading={isSubmitting}
            style={isStandalone ? { padding: '10px 24px', fontSize: '15px' } : undefined}
          >
            Publish Letter
          </Button>
        </div>
      </div>
    </form>
  );
};
