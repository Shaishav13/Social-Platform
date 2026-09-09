import React, { useState, useRef } from 'react';
import { Icon, Button } from '../ui';
import api from '../../services/api';

interface ComposeLetterProps {
  onPostCreated?: () => void;
  placeholder?: string;
}

export const ComposeLetter: React.FC<ComposeLetterProps> = ({
  onPostCreated,
  placeholder = 'Write a letter, essay, or thought...',
}) => {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{ file: File; previewUrl: string; isVideo: boolean }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (selectedFiles.length + files.length > 5) {
      setError('You can attach a maximum of 5 photos or videos per letter.');
      return;
    }

    const newAttachments: { file: File; previewUrl: string; isVideo: boolean }[] = [];
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 25MB file size limit.`);
        return;
      }
      const isVideo = file.type.startsWith('video/') || Boolean(file.name.match(/\.(mp4|webm|mov|m4v)$/i));
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

    try {
      setIsSubmitting(true);
      setError('');

      let mediaUrls: string[] = [];

      // If files attached, upload all together
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach((item) => {
          formData.append('media', item.file);
          formData.append('files', item.file);
        });

        const uploadRes = await api.post('/content/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (Array.isArray(uploadRes.data?.urls) && uploadRes.data.urls.length > 0) {
          mediaUrls = uploadRes.data.urls;
        } else if (Array.isArray(uploadRes.data?.media) && uploadRes.data.media.length > 0) {
          mediaUrls = uploadRes.data.media.map((m: any) => m.url || m);
        } else if (uploadRes.data?.url) {
          mediaUrls = [uploadRes.data.url];
        }
      }

      await api.post('/content/posts', {
        content: content.trim(),
        mediaUrls,
      });

      setContent('');
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
    <form className="wren-compose" onSubmit={handleSubmit} aria-label="Compose post">
      {error && <div className="wren-error" role="alert" style={{ marginBottom: '12px' }}>{error}</div>}

      <textarea
        className="wren-compose-input"
        placeholder={placeholder}
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={2}
        aria-label="Write a letter or post"
      />

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
            className="wren-action-item"
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            title="Attach images or videos (up to 5)"
            aria-label="Attach media"
          >
            <Icon name="image" size={18} />
            <span style={{ fontSize: '13px', color: 'var(--ink-600)' }}>Photos & Videos</span>
          </label>
        </div>

        {/* Send button fades in only when text exists (absent when empty) */}
        <div className={`wren-compose-btn ${hasContent ? 'is-visible' : ''}`}>
          <Button
            type="submit"
            variant="primary"
            disabled={!hasContent || isSubmitting}
            isLoading={isSubmitting}
          >
            Publish Letter
          </Button>
        </div>
      </div>
    </form>
  );
};
