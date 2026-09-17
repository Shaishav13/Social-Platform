import { FileStorageConfig, MediaUploadResult } from './types';
import path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
  private s3Client: S3Client | null = null;

  constructor(config?: FileStorageConfig) {
    const hasCloudinary = this.checkCloudinaryConfig();
    const hasS3 = this.checkS3Config();
    
    this.config = config || {
      type: hasS3 ? 's3' : (hasCloudinary ? 'cloudinary' : 'local'),
      localPath: process.env.UPLOAD_PATH || './uploads',
      s3Config: hasS3 ? {
        endpoint: process.env.S3_ENDPOINT,
        bucket: process.env.S3_BUCKET_NAME!,
        region: process.env.S3_REGION || 'auto',
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        publicUrl: process.env.S3_PUBLIC_URL
      } : undefined
    };
    
    if (this.config.type === 's3') {
      this.initS3();
    } else if (hasCloudinary) {
      this.initCloudinary();
    }
  }

  private checkS3Config(): boolean {
    return !!(
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY &&
      process.env.S3_BUCKET_NAME &&
      process.env.S3_ENDPOINT
    );
  }

  private initS3(): void {
    if (!this.config.s3Config) return;
    try {
      this.s3Client = new S3Client({
        region: this.config.s3Config.region,
        endpoint: this.config.s3Config.endpoint,
        credentials: {
          accessKeyId: this.config.s3Config.accessKeyId,
          secretAccessKey: this.config.s3Config.secretAccessKey,
        },
      });
      console.log(`🪣  S3 Storage configured for bucket: ${this.config.s3Config.bucket}`);
    } catch (err) {
      console.error('⚠️ Failed to config S3 Client:', err);
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
    if (!this.s3Client || !this.config.s3Config) {
      throw new Error('S3 Client is not initialized properly.');
    }

    const key = `udtabirdie/posts/${filename}`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.s3Config.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      // Return the public URL if configured, otherwise build an S3 URL
      let url = '';
      if (this.config.s3Config.publicUrl) {
        url = `${this.config.s3Config.publicUrl.replace(/\/$/, '')}/${key}`;
      } else {
        url = `${this.config.s3Config.endpoint?.replace(/\/$/, '')}/${this.config.s3Config.bucket}/${key}`;
      }

      return { filename: key, url };
    } catch (error) {
      console.error('S3 upload failed:', error);
      throw error;
    }
  }

  async deleteFile(filename: string): Promise<void> {
    if (this.config.type === 's3') {
      try {
        await this.deleteFileFromS3(filename);
        return;
      } catch (err) {
        console.warn('S3 delete failed, trying local fallback:', err);
      }
    } else if (filename.startsWith('udtabirdie/') || this.checkCloudinaryConfig()) {
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
    if (!this.s3Client || !this.config.s3Config) {
      throw new Error('S3 Client is not initialized properly.');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.s3Config.bucket,
        Key: filename,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('S3 deletion failed:', error);
      throw error;
    }
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