import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SavedFileResult {
  storageKey: string;
  checksum: string;
  size: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created uploads directory at: ${this.uploadDir}`);
    }
  }

  /**
   * Calculates SHA-256 hash of a buffer
   */
  calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Saves a file buffer to disk. Returns unique storage key and SHA-256 checksum.
   */
  async saveFile(file: UploadedMulterFile): Promise<SavedFileResult> {
    const checksum = this.calculateChecksum(file.buffer);
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    const destination = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(destination, file.buffer);

    return {
      storageKey: filename,
      checksum,
      size: file.size,
    };
  }

  /**
   * Resolves absolute file path on disk
   */
  getFilePath(storageKey: string): string {
    return path.join(this.uploadDir, storageKey);
  }

  /**
   * Check if file exists on disk
   */
  fileExists(storageKey: string): boolean {
    return fs.existsSync(this.getFilePath(storageKey));
  }

  /**
   * Get file stats (size, etc.)
   */
  async getFileStats(storageKey: string): Promise<fs.Stats> {
    return fs.promises.stat(this.getFilePath(storageKey));
  }

  /**
   * Creates a readable stream, optionally with byte range (for video partial streaming)
   */
  createReadStream(storageKey: string, options?: { start?: number; end?: number }): fs.ReadStream {
    return fs.createReadStream(this.getFilePath(storageKey), options);
  }

  /**
   * Delete file from disk
   */
  async deleteFile(storageKey: string): Promise<void> {
    const fullPath = this.getFilePath(storageKey);
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
      this.logger.log(`Deleted file: ${storageKey}`);
    }
  }
}
