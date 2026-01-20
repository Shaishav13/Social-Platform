import { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

interface CreatePostProps {
  onPostCreated?: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated }) => {
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/mov', 'video/avi', 'video/webm'];
  const MAX_FILES = 5;

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is 10MB.`;
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      return `File "${file.name}" is not a supported format. Please use JPEG, PNG, GIF, WebP, MP4, MOV, AVI, or WebM.`;
    }

    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (selectedFiles.length + files.length > MAX_FILES) {
      setError(`You can only upload up to ${MAX_FILES} files at once.`);
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    let hasError = false;

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        hasError = true;
        break;
      }

      validFiles.push(file);
      
      // Create preview
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string);
          if (newPreviews.length === validFiles.length) {
            setPreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // For videos, we'll show a placeholder or video element
        newPreviews.push('video-placeholder');
      }
    }

    if (!hasError) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setError('');
      
      // For videos, set previews immediately
      if (validFiles.some(f => ALLOWED_VIDEO_TYPES.includes(f.type))) {
        setPreviews(prev => [...prev, ...newPreviews]);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
    setUploadProgress(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim() && selectedFiles.length === 0) {
      setError('Please add some content or select files to share.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let mediaIds: string[] = [];

      // Upload files if any
      if (selectedFiles.length > 0) {
        const formData = new FormData();
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });

        const response = await api.post('/content/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              // Set progress for all files (simplified)
              setUploadProgress(selectedFiles.map(() => progress));
            }
          },
        });

        // Extract IDs from the response
        mediaIds = response.data.uploads.map((upload: any) => upload.id);
      }
        
      // Create post
      const postData = {
        content: content.trim(),
        mediaIds,
        isPublic: true,
      };

      await api.post('/content/posts', postData);

      // Reset form
      setContent('');
      setSelectedFiles([]);
      setPreviews([]);
      setUploadProgress([]);
      
      if (onPostCreated) {
        onPostCreated();
      }

    } catch (err: any) {
      console.error('Post creation error:', err);
      setError(err.response?.data?.message || 'Failed to create post. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    
    if (files.length + selectedFiles.length > MAX_FILES) {
      setError(`You can only upload up to ${MAX_FILES} files at once.`);
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    let hasError = false;

    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        hasError = true;
        break;
      }

      validFiles.push(file);
      
      // Create preview
      if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string);
          if (newPreviews.length === validFiles.length) {
            setPreviews(prev => [...prev, ...newPreviews]);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // For videos, we'll show a placeholder
        newPreviews.push('video-placeholder');
      }
    }

    if (!hasError) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setError('');
      
      // For videos, set previews immediately
      if (validFiles.some(f => ALLOWED_VIDEO_TYPES.includes(f.type))) {
        setPreviews(prev => [...prev, ...newPreviews]);
      }
    }
  };

  return (
    <div className="create-post-modern">
      <div className="create-post-header">
        <div className="user-info">
          {user?.profilePicture ? (
            <img 
              src={user.profilePicture} 
              alt={user.username}
              className="user-avatar"
            />
          ) : (
            <div className="user-avatar-placeholder">
              {user?.username?.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="user-details">
            <span className="username">{user?.username}</span>
            <span className="post-visibility">🌍 Public</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="create-post-form">
        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        <div className="content-input-container">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className="post-textarea"
            rows={4}
            disabled={isLoading}
          />
          <div className="character-count">
            <span className={content.length > 280 ? 'over-limit' : ''}>
              {content.length}/500
            </span>
          </div>
        </div>

        {/* File Upload Area */}
        <div 
          className={`file-upload-area ${selectedFiles.length > 0 ? 'has-files' : ''}`}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={[...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES].join(',')}
            onChange={handleFileSelect}
            className="file-input"
            disabled={isLoading}
          />
          
          {selectedFiles.length === 0 && (
            <div className="upload-prompt">
              <div className="upload-icon">📸</div>
              <h3>Add photos or videos</h3>
              <p>Drag and drop here or <button type="button" onClick={() => fileInputRef.current?.click()} className="upload-link">browse files</button></p>
              <p className="upload-hint">Support: Images and Videos up to 10MB each</p>
            </div>
          )}
        </div>

        {/* File Previews */}
        {selectedFiles.length > 0 && (
          <div className="file-previews-modern">
            <div className="previews-header">
              <h4>Media ({selectedFiles.length}/{MAX_FILES})</h4>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="add-more-btn"
                disabled={selectedFiles.length >= MAX_FILES || isLoading}
              >
                + Add More
              </button>
            </div>
            
            <div className="previews-grid">
              {selectedFiles.map((file, index) => (
                <div key={index} className="file-preview-modern">
                  <div className="preview-content">
                    {ALLOWED_IMAGE_TYPES.includes(file.type) ? (
                      <img 
                        src={previews[index]} 
                        alt={`Preview ${index + 1}`}
                        className="preview-image"
                      />
                    ) : (
                      <div className="video-preview">
                        <div className="video-icon">🎥</div>
                        <span className="video-name">{file.name}</span>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="remove-file-btn"
                      disabled={isLoading}
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="preview-info">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>

                  {uploadProgress[index] !== undefined && uploadProgress[index] < 100 && (
                    <div className="upload-progress">
                      <div 
                        className="progress-bar"
                        style={{ width: `${uploadProgress[index]}%` }}
                      />
                      <span className="progress-text">{uploadProgress[index]}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="create-post-footer">
          <div className="post-options">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="option-btn media-btn"
              disabled={isLoading || selectedFiles.length >= MAX_FILES}
              title="Add photos or videos"
            >
              <span className="option-icon">📷</span>
              <span className="option-text">Media</span>
            </button>
            
            <button
              type="button"
              className="option-btn emoji-btn"
              disabled={isLoading}
              title="Add emoji"
            >
              <span className="option-icon">😊</span>
              <span className="option-text">Emoji</span>
            </button>
            
            <button
              type="button"
              className="option-btn location-btn"
              disabled={isLoading}
              title="Add location"
            >
              <span className="option-icon">📍</span>
              <span className="option-text">Location</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={isLoading || (!content.trim() && selectedFiles.length === 0)}
            className="post-submit-btn"
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Posting...
              </>
            ) : (
              <>
                <span className="submit-icon">📤</span>
                Post
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;