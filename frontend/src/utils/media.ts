/**
 * Utility functions for handling media URLs and content
 */

/**
 * Resolves a media URL to an absolute URL pointing to the backend server
 * @param url - The media URL (can be relative or absolute)
 * @returns Absolute URL pointing to the backend server
 */
export function resolveMediaUrl(url: string): string {
  // If URL is already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // In development, use relative URLs to leverage Vite proxy
  if (import.meta.env.DEV) {
    // Ensure the URL starts with a slash for relative URLs
    const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
    return normalizedUrl;
  }
  
  // In production, use the full backend URL
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3003/api/v1';
  const backendBaseUrl = apiUrl.replace('/api/v1', '');
  
  // Ensure the URL starts with a slash
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;
  
  return `${backendBaseUrl}${normalizedUrl}`;
}

/**
 * Handles media loading errors by hiding the element and logging the error
 * @param event - The error event
 * @param url - The original URL that failed to load
 */
export function handleMediaError(event: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>, url: string): void {
  console.error('Failed to load media:', url);
  event.currentTarget.style.display = 'none';
}

/**
 * Gets the appropriate alt text for media based on its index and type
 * @param index - The index of the media item
 * @param mediaType - The type of media ('image' or 'video')
 * @returns Appropriate alt text
 */
export function getMediaAltText(index: number, mediaType: 'image' | 'video'): string {
  const mediaNumber = index + 1;
  return `Post ${mediaType} ${mediaNumber}`;
}

/**
 * Checks if a URL is a valid media URL
 * @param url - The URL to check
 * @returns True if the URL appears to be a valid media URL
 */
export function isValidMediaUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Check for common media file extensions
  const mediaExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm)$/i;
  return mediaExtensions.test(url) || url.includes('/uploads/');
}

/**
 * Preloads an image to improve loading performance
 * @param url - The image URL to preload
 * @returns Promise that resolves when the image is loaded
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to preload image: ${url}`));
    img.src = resolveMediaUrl(url);
  });
}

/**
 * Gets the file size in a human-readable format
 * @param bytes - The size in bytes
 * @returns Human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}