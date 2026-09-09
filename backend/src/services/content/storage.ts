import { FileStorageConfig, MediaUploadResult } from './types';
import path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export class FileStorageService {
  private config: FileStorageConfig;

  constructor(config?: FileStorageConfig) {
    this.config = config || {
      type: 'local',
      localPath: process.env.UPLOAD_PATH || './uploads'
    };
  }

  async initialize(): Promise<void> {
    if (this.config.type === 'local' && this.config.localPath) {
      // Ensure upload directory exists
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
    
    if (this.config.type === 'local') {
      return this.saveFileLocally(buffer, filename, mimeType);
    } else if (this.config.type === 's3') {
      return this.saveFileToS3(buffer, filename, mimeType);
    }
    
    throw new Error(`Unsupported storage type: ${this.config.type}`);
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
    throw new Error('S3 storage not implemented yet. Please use local storage.');
  }

  async deleteFile(filename: string): Promise<void> {
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