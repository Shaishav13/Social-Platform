/**
 * Preboot environment sanitization
 * Ensures environment variables (like CLOUDINARY_URL) are cleaned and well-formed
 * before any third-party SDK tries to parse them during module import.
 */

if (process.env.CLOUDINARY_URL) {
  let raw = process.env.CLOUDINARY_URL.trim().replace(/^["']+|["']+$/g, '');
  if (raw.startsWith('CLOUDINARY_URL=')) {
    raw = raw.substring('CLOUDINARY_URL='.length).trim().replace(/^["']+|["']+$/g, '');
  }
  
  const match = raw.match(/cloudinary:\/\/[^\s"']+/);
  if (match) {
    process.env.CLOUDINARY_URL = match[0];
  } else {
    console.warn('⚠️ [Preboot] Invalid CLOUDINARY_URL format detected. Unsetting to avoid startup crash. Raw value was:', raw);
    delete process.env.CLOUDINARY_URL;
  }
}
