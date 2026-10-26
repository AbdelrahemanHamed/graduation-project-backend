import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  PayloadTooLargeException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService, UploadedMulterFile } from '../storage/storage.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { UpdateFileDto } from './dto/update-file.dto.js';
import { MoveFileDto } from './dto/move-file.dto.js';
import { ActivityAction, PermissionRole, ResourceType } from '@prisma/client';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Check if user has read or write access to file
   */
  async checkFileAccess(
    fileId: string,
    userId: string,
    requiredRole: 'VIEWER' | 'EDITOR' = 'VIEWER',
  ) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      include: {
        folder: true,
        sharedAccesses: {
          where: { userId },
        },
      },
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Direct owner
    if (file.ownerId === userId) {
      return { file, isOwner: true, role: 'OWNER' as const };
    }

    // Direct file share
    const directShare = file.sharedAccesses[0];
    if (directShare) {
      if (requiredRole === 'EDITOR' && directShare.role === PermissionRole.VIEWER) {
        throw new ForbiddenException('You only have Viewer permission on this file');
      }
      return { file, isOwner: false, role: directShare.role };
    }

    // Check inherited folder share
    if (file.folderId) {
      const folderShare = await this.prisma.sharedAccess.findFirst({
        where: {
          folderId: file.folderId,
          userId,
        },
      });

      if (folderShare) {
        if (requiredRole === 'EDITOR' && folderShare.role === PermissionRole.VIEWER) {
          throw new ForbiddenException('You only have Viewer permission on this folder');
        }
        return { file, isOwner: false, role: folderShare.role };
      }
    }

    throw new ForbiddenException('You do not have access to this file');
  }

  /**
   * Upload file with quota enforcement and SHA-256 deduplication
   */
  async uploadFile(userId: string, multerFile: UploadedMulterFile, folderId?: string) {
    if (!multerFile) {
      throw new BadRequestException('No file provided');
    }

    const fileSize = BigInt(multerFile.size);

    // 1. Check storage quota
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { storageUsed: true, storageLimit: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.storageUsed + fileSize > user.storageLimit) {
      throw new PayloadTooLargeException('Storage quota exceeded. Please free up space.');
    }

    // 2. Check if folder exists & user has write access
    if (folderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: folderId },
        include: { sharedAccesses: { where: { userId } } },
      });

      if (!folder) {
        throw new NotFoundException('Target folder does not exist');
      }

      if (folder.ownerId !== userId) {
        const share = folder.sharedAccesses[0];
        if (!share || share.role !== PermissionRole.EDITOR) {
          throw new ForbiddenException('No write permission in this folder');
        }
      }
    }

    // 3. Deduplication Check via SHA-256 Checksum
    const checksum = this.storage.calculateChecksum(multerFile.buffer);
    let storageKey: string;

    const existingMatchingFile = await this.prisma.file.findFirst({
      where: { checksum },
      select: { storageKey: true },
    });

    if (existingMatchingFile && this.storage.fileExists(existingMatchingFile.storageKey)) {
      // Binary already exists on disk! Reuse key (instant upload & deduplicated storage)
      storageKey = existingMatchingFile.storageKey;
    } else {
      // Save new file to disk
      const saved = await this.storage.saveFile(multerFile);
      storageKey = saved.storageKey;
    }

    // 4. Create File record & update user storageUsed in transaction
    const [file] = await this.prisma.$transaction([
      this.prisma.file.create({
        data: {
          name: multerFile.originalname,
          originalName: multerFile.originalname,
          mimeType: multerFile.mimetype || 'application/octet-stream',
          size: fileSize,
          storageKey,
          checksum,
          folderId: folderId || null,
          ownerId: userId,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { increment: fileSize } },
      }),
    ]);

    // 5. Audit log
    await this.activity.log({
      userId,
      action: ActivityAction.UPLOAD,
      resourceType: ResourceType.FILE,
      resourceId: file.id,
      details: { name: file.name, size: Number(file.size), mimeType: file.mimeType },
    });

    return file;
  }

  /**
   * Get single file metadata
   */
  async getFile(fileId: string, userId: string) {
    const { file } = await this.checkFileAccess(fileId, userId, 'VIEWER');
    return file;
  }

  /**
   * Prepare file stream for download
   */
  async getFileDownload(fileId: string, userId: string) {
    const { file } = await this.checkFileAccess(fileId, userId, 'VIEWER');

    if (!this.storage.fileExists(file.storageKey)) {
      throw new NotFoundException('Physical file missing on server storage');
    }

    const stream = this.storage.createReadStream(file.storageKey);

    await this.activity.log({
      userId,
      action: ActivityAction.DOWNLOAD,
      resourceType: ResourceType.FILE,
      resourceId: file.id,
    });

    return {
      stream,
      file,
    };
  }

  /**
   * Video / Media Streaming with HTTP 206 Partial Content Range support
   */
  async streamMedia(fileId: string, userId: string, rangeHeader?: string) {
    const { file } = await this.checkFileAccess(fileId, userId, 'VIEWER');

    if (!this.storage.fileExists(file.storageKey)) {
      throw new NotFoundException('Media file missing on server');
    }

    const totalSize = Number(file.size);

    if (!rangeHeader) {
      const stream = this.storage.createReadStream(file.storageKey);
      return {
        stream,
        status: 200,
        headers: {
          'Content-Length': totalSize,
          'Content-Type': file.mimeType,
          'Accept-Ranges': 'bytes',
        },
      };
    }

    // Parse Range: e.g. "bytes=0-1048575"
    const parts = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

    if (start >= totalSize || end >= totalSize) {
      return {
        stream: null,
        status: 416,
        headers: {
          'Content-Range': `bytes */${totalSize}`,
        },
      };
    }

    const chunkSize = end - start + 1;
    const stream = this.storage.createReadStream(file.storageKey, { start, end });

    return {
      stream,
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': file.mimeType,
      },
    };
  }

  /**
   * Move file to another folder or root
   */
  async moveFile(userId: string, fileId: string, dto: MoveFileDto) {
    const { file } = await this.checkFileAccess(fileId, userId, 'EDITOR');

    const targetFolderId = dto.targetFolderId || null;

    if (targetFolderId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: targetFolderId },
        include: { sharedAccesses: { where: { userId } } },
      });

      if (!folder) {
        throw new NotFoundException('Target folder does not exist');
      }

      if (folder.ownerId !== userId) {
        const share = folder.sharedAccesses[0];
        if (!share || share.role !== PermissionRole.EDITOR) {
          throw new ForbiddenException('No write permission in target folder');
        }
      }
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { folderId: targetFolderId },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.MOVE,
      resourceType: ResourceType.FILE,
      resourceId: fileId,
      details: { fromFolderId: file.folderId, toFolderId: targetFolderId },
    });

    return updated;
  }

  /**
   * Rename or Star/Unstar file
   */
  async updateFile(userId: string, fileId: string, dto: UpdateFileDto) {
    await this.checkFileAccess(fileId, userId, 'EDITOR');

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.isStarred !== undefined ? { isStarred: dto.isStarred } : {}),
      },
    });

    if (dto.name) {
      await this.activity.log({
        userId,
        action: ActivityAction.RENAME,
        resourceType: ResourceType.FILE,
        resourceId: fileId,
        details: { newName: dto.name },
      });
    }

    return updated;
  }

  /**
   * Soft delete (Trash)
   */
  async trashFile(userId: string, fileId: string) {
    await this.checkFileAccess(fileId, userId, 'EDITOR');

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { isTrashed: true, trashedAt: new Date() },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.DELETE,
      resourceType: ResourceType.FILE,
      resourceId: fileId,
    });

    return updated;
  }

  /**
   * Restore file from Trash
   */
  async restoreFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== userId) {
      throw new NotFoundException('File not found');
    }

    const updated = await this.prisma.file.update({
      where: { id: fileId },
      data: { isTrashed: false, trashedAt: null },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.RESTORE,
      resourceType: ResourceType.FILE,
      resourceId: fileId,
    });

    return updated;
  }

  /**
   * Permanently delete file and reclaim storage quota
   */
  async permanentlyDeleteFile(userId: string, fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file || file.ownerId !== userId) {
      throw new NotFoundException('File not found');
    }

    // Check if other files share the exact same storage key (deduplication)
    const otherReferences = await this.prisma.file.count({
      where: { storageKey: file.storageKey, id: { not: fileId } },
    });

    if (otherReferences === 0) {
      // Safe to purge physical file from disk
      await this.storage.deleteFile(file.storageKey);
    }

    // Decrement user's storageUsed and delete row
    await this.prisma.$transaction([
      this.prisma.file.delete({ where: { id: fileId } }),
      this.prisma.user.update({
        where: { id: userId },
        data: { storageUsed: { decrement: file.size } },
      }),
    ]);

    return { message: 'File permanently deleted' };
  }

  /**
   * Starred files list
   */
  async getStarredFiles(userId: string) {
    return this.prisma.file.findMany({
      where: { ownerId: userId, isStarred: true, isTrashed: false },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Trashed files list
   */
  async getTrashedFiles(userId: string) {
    return this.prisma.file.findMany({
      where: { ownerId: userId, isTrashed: true },
      orderBy: { trashedAt: 'desc' },
    });
  }
}
