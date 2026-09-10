import { FileStorageConfig, MediaUploadResult } from './types';
import path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
function getCloudinaryInstance(): any {
  if (process.env.CLOUDINARY_URL) {
    let raw = process.env.CLOUDINARY_URL.trim().replace(/^["']+|["']+$/g, '');
    if (raw.startsWith('CLOUDINARY_URL=')) {
      raw = raw.substring('CLOUDINARY_URL='.length).trim().replace(/^["']+|["']+$/g, '');
    }
    const match = raw.match(/cloudinary:\/\/[^\s"']+/);
    if (match) {
      process.env.CLOUDINARY_URL = match[0];
    } else {
      console.warn('⚠️ [Storage] Invalid CLOUDINARY_URL format. Unsetting to avoid crash. Raw was:', raw);
      delete process.env.CLOUDINARY_URL;
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cloudinary = require('cloudinary').v2;
    return cloudinary;
  } catch (err) {
    console.error('⚠️ Could not load cloudinary module:', err);
    return null;
  }
}

export class FileStorageService {
  private config: FileStorageConfig;

  constructor(config?: FileStorageConfig) {
    const hasCloudinary = this.checkCloudinaryConfig();
    this.config = config || {
      type: hasCloudinary ? 'cloudinary' : 'local',
      localPath: process.env.UPLOAD_PATH || './uploads'
    };
    if (hasCloudinary) {
      this.initCloudinary();
    }
  }

  private checkCloudinaryConfig(): boolean {
    const url = process.env.CLOUDINARY_URL?.trim();
    if (url && (url.startsWith('cloudinary://') || url.includes('cloudinary://')) && !url.includes('***')) {
      return true;
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    return !!(cloudName && apiKey && apiSecret && !apiSecret.includes('***'));
  }

  private initCloudinary(): void {
    const cloudinary = getCloudinaryInstance();
    if (!cloudinary) return;

    const url = process.env.CLOUDINARY_URL?.trim();
    if (url && !url.includes('***')) {
      try {
        cloudinary.config({
          cloudinary_url: url,
          secure: true
        });
        console.log('☁️ Cloudinary storage configured via CLOUDINARY_URL');
        return;
      } catch (err) {
        console.warn('⚠️ Failed to config Cloudinary with CLOUDINARY_URL:', err);
      }
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (cloudName && apiKey && apiSecret) {
      try {
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true
        });
        console.log(`☁️ Cloudinary storage configured for cloud: ${cloudName}`);
      } catch (err) {
        console.warn('⚠️ Failed to config Cloudinary with credentials:', err);
      }
    }
  }

  async initialize(): Promise<void> {
    if (this.checkCloudinaryConfig()) {
      this.initCloudinary();
    }

    if (this.config.localPath) {
      // Ensure local upload directory exists as fallback or default
      try {
        await fs.access(this.config.localPath);
      } catch {
        await fs.mkdir(this.config.localPath, { recursive: true });
      }

      // Create subdirectories for organization
      const subdirs = ['images', 'videos', 'documents'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(this.config.localPath, subdir);
        try {
          await fs.access(subdirPath);
        } catch {
          await fs.mkdir(subdirPath, { recursive: true });
        }
      }
    }
  }

  async saveFile(
    buffer: Buffer, 
    originalName: string, 
    mimeType: string
  ): Promise<{ filename: string; url: string }> {
    const ext = path.extname(originalName).toLowerCase();
    const safeExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', '.avi'];
    if (!safeExtensions.includes(ext)) {
      throw new Error(`Disallowed file extension: ${ext}. Only standard image and video formats are permitted.`);
    }

    // Inspect file header for active executable content or scripts
    const sample = buffer.slice(0, 1024).toString('utf8').toLowerCase();
    if (sample.includes('<script') || sample.includes('<?php') || sample.includes('javascript:') || sample.includes('<html')) {
      throw new Error('File validation failed: Active executable or script content detected in upload.');
    }

    const filename = `${uuidv4()}${ext}`;
    
    // If Cloudinary is configured or explicitly selected, upload to Cloud CDN
    if (this.checkCloudinaryConfig() || this.config.type === 'cloudinary') {
      try {
        return await this.saveFileToCloudinary(buffer, filename, mimeType);
      } catch (error) {
        console.error('❌ Cloudinary upload failed, falling back to local storage:', error);
        return this.saveFileLocally(buffer, filename, mimeType);
      }
    }

    if (this.config.type === 'local') {
      return this.saveFileLocally(buffer, filename, mimeType);
    } else if (this.config.type === 's3') {
      return this.saveFileToS3(buffer, filename, mimeType);
    }
    
    throw new Error(`Unsupported storage type: ${this.config.type}`);
  }

  private async saveFileToCloudinary(
    buffer: Buffer,
    filename: string,
    mimeType: string
  ): Promise<{ filename: string; url: string }> {
    const cloudinary = getCloudinaryInstance();
    if (!cloudinary) {
      throw new Error('Cloudinary SDK unavailable');
    }

    return new Promise((resolve, reject) => {
      const isVideo = mimeType.startsWith('video/');
      const resourceType: 'image' | 'video' | 'raw' = isVideo ? 'video' : 'image';
      const cleanName = path.parse(filename).name;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'udtabirdie/posts',
          resource_type: resourceType,
          public_id: cleanName,
          overwrite: true
        },
        (error: any, result: any) => {
          if (error || !result) {
            console.error('[Cloudinary] Upload stream error:', error);
            return reject(error || new Error('Cloudinary upload stream failed'));
          }
          resolve({
            filename: result.public_id,
            url: result.secure_url
          });
        }
      );

      uploadStream.end(buffer);
    });
  }

  private async saveFileLocally(
    buffer: Buffer, 
    filename: string, 
    mimeType: string
  ): Promise<{ filename: string; url: string }> {
    if (!this.config.localPath) {
      throw new Error('Local path not configured');
    }

    // Determine subdirectory based on mime type
    let subdir = 'documents';
    if (mimeType.startsWith('image/')) {
      subdir = 'images';
    } else if (mimeType.startsWith('video/')) {
      subdir = 'videos';
    }

    const filePath = path.join(this.config.localPath, subdir, filename);
    await fs.writeFile(filePath, buffer);

    // Generate URL (assuming we serve static files from /uploads)
    const url = `/uploads/${subdir}/${filename}`;
    
    return { filename, url };
  }

  private async saveFileToS3(
    buffer: Buffer, 
    filename: string, 
    mimeType: string
  ): Promise<{ filename: string; url: string }> {
    // S3 implementation would go here
    // For now, throw an error as S3 SDK is not installed
    throw new Error('S3 storage not implemented yet. Please use local storage or Cloudinary.');
  }

  async deleteFile(filename: string): Promise<void> {
    if (filename.startsWith('udtabirdie/') || this.checkCloudinaryConfig()) {
      try {
        const cloudinary = getCloudinaryInstance();
        if (cloudinary) {
          await cloudinary.uploader.destroy(filename);
          return;
        }
      } catch (err) {
        console.warn('Cloudinary delete failed, trying local fallback:', err);
      }
    }

    if (this.config.type === 'local') {
      await this.deleteFileLocally(filename);
    } else if (this.config.type === 's3') {
      await this.deleteFileFromS3(filename);
    }
  }

  private async deleteFileLocally(filename: string): Promise<void> {
    if (!this.config.localPath) {
      throw new Error('Local path not configured');
    }

    // Try to find the file in subdirectories
    const subdirs = ['images', 'videos', 'documents'];
    
    for (const subdir of subdirs) {
      const filePath = path.join(this.config.localPath, subdir, filename);
      try {
        await fs.access(filePath);
        await fs.unlink(filePath);
        return;
      } catch {
        // File not found in this directory, continue
      }
    }
    
    throw new Error(`File not found: ${filename}`);
  }

  private async deleteFileFromS3(filename: string): Promise<void> {
    // S3 deletion implementation would go here
    throw new Error('S3 storage not implemented yet. Please use local storage.');
  }

  getConfig(): FileStorageConfig {
    return { ...this.config };
  }

  static validateFileType(mimeType: string): boolean {
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      // Videos
      'video/mp4',
      'video/quicktime', // .mov
      'video/x-msvideo', // .avi
      'video/webm'
    ];

    return allowedTypes.includes(mimeType.toLowerCase());
  }

  static validateFileSize(size: number, maxSizeMB: number = 50): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024; // Convert MB to bytes
    return size > 0 && size <= maxSizeBytes; // Must be greater than 0 and within limit
  }

  static getFileCategory(mimeType: string): 'image' | 'video' | 'document' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    }
    return 'document';
  }
}

// Singleton instance
export const fileStorageService = new FileStorageService();