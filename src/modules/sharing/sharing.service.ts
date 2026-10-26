import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { ShareByEmailDto } from './dto/share-by-email.dto.js';
import { CreateShareLinkDto } from './dto/create-share-link.dto.js';
import { ActivityAction, PermissionRole, ResourceType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SharingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Share file or folder with another user by email
   */
  async shareByEmail(currentUserId: string, dto: ShareByEmailDto) {
    if ((!dto.fileId && !dto.folderId) || (dto.fileId && dto.folderId)) {
      throw new BadRequestException('You must specify either fileId or folderId, not both');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!recipient) {
      throw new NotFoundException(`No registered user found with email: ${dto.email}`);
    }

    if (recipient.id === currentUserId) {
      throw new BadRequestException('You cannot share a resource with yourself');
    }

    let resourceName = '';

    // Verify ownership/write access
    if (dto.fileId) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.fileId } });
      if (!file) throw new NotFoundException('File not found');
      if (file.ownerId !== currentUserId) {
        throw new ForbiddenException('Only the owner can manage sharing permissions for this file');
      }
      resourceName = file.name;

      const share = await this.prisma.sharedAccess.upsert({
        where: {
          userId_fileId: {
            userId: recipient.id,
            fileId: dto.fileId,
          },
        },
        update: { role: dto.role },
        create: {
          userId: recipient.id,
          fileId: dto.fileId,
          role: dto.role,
        },
      });

      await this.activity.log({
        userId: currentUserId,
        action: ActivityAction.SHARE,
        resourceType: ResourceType.FILE,
        resourceId: dto.fileId,
        details: { sharedWith: recipient.email, role: dto.role, fileName: resourceName },
      });

      return { share, recipient: { id: recipient.id, email: recipient.email, name: recipient.name } };
    } else if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({ where: { id: dto.folderId } });
      if (!folder) throw new NotFoundException('Folder not found');
      if (folder.ownerId !== currentUserId) {
        throw new ForbiddenException('Only the owner can manage sharing permissions for this folder');
      }
      resourceName = folder.name;

      const share = await this.prisma.sharedAccess.upsert({
        where: {
          userId_folderId: {
            userId: recipient.id,
            folderId: dto.folderId,
          },
        },
        update: { role: dto.role },
        create: {
          userId: recipient.id,
          folderId: dto.folderId,
          role: dto.role,
        },
      });

      await this.activity.log({
        userId: currentUserId,
        action: ActivityAction.SHARE,
        resourceType: ResourceType.FOLDER,
        resourceId: dto.folderId,
        details: { sharedWith: recipient.email, role: dto.role, folderName: resourceName },
      });

      return { share, recipient: { id: recipient.id, email: recipient.email, name: recipient.name } };
    }
  }

  /**
   * Revoke shared access from a collaborator
   */
  async revokeAccess(currentUserId: string, shareId: string) {
    const share = await this.prisma.sharedAccess.findUnique({
      where: { id: shareId },
      include: { file: true, folder: true, user: true },
    });

    if (!share) {
      throw new NotFoundException('Share record not found');
    }

    const ownerId = share.file?.ownerId || share.folder?.ownerId;
    if (ownerId !== currentUserId && share.userId !== currentUserId) {
      throw new ForbiddenException('You are not authorized to revoke this access');
    }

    await this.prisma.sharedAccess.delete({ where: { id: shareId } });

    await this.activity.log({
      userId: currentUserId,
      action: ActivityAction.REVOKE_SHARE,
      resourceType: share.fileId ? ResourceType.FILE : ResourceType.FOLDER,
      resourceId: (share.fileId || share.folderId)!,
      details: { revokedUserEmail: share.user.email },
    });

    return { message: 'Shared access successfully revoked' };
  }

  /**
   * List all users who have access to a file or folder
   */
  async listCollaborators(currentUserId: string, fileId?: string, folderId?: string) {
    if (!fileId && !folderId) {
      throw new BadRequestException('Specify either fileId or folderId');
    }

    return this.prisma.sharedAccess.findMany({
      where: {
        ...(fileId ? { fileId } : {}),
        ...(folderId ? { folderId } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * Get all items "Shared With Me" (Google Drive Shared Section)
   */
  async getSharedWithMe(userId: string) {
    const shares = await this.prisma.sharedAccess.findMany({
      where: { userId },
      include: {
        folder: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { files: true, subFolders: true } },
          },
        },
        file: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const folders = shares
      .filter((s) => s.folder && !s.folder.isTrashed)
      .map((s) => ({ ...s.folder, shareRole: s.role, shareId: s.id }));

    const files = shares
      .filter((s) => s.file && !s.file.isTrashed)
      .map((s) => ({ ...s.file, shareRole: s.role, shareId: s.id }));

    return { folders, files };
  }

  /**
   * Create public shareable link (Google Drive Get Link)
   */
  async createShareLink(userId: string, dto: CreateShareLinkDto) {
    if ((!dto.fileId && !dto.folderId) || (dto.fileId && dto.folderId)) {
      throw new BadRequestException('Must specify either fileId or folderId, not both');
    }

    // Verify ownership
    if (dto.fileId) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.fileId } });
      if (!file || file.ownerId !== userId) {
        throw new ForbiddenException('Only the file owner can create public links');
      }
    } else if (dto.folderId) {
      const folder = await this.prisma.folder.findUnique({ where: { id: dto.folderId } });
      if (!folder || folder.ownerId !== userId) {
        throw new ForbiddenException('Only the folder owner can create public links');
      }
    }

    // Hash password if supplied
    let passwordHash: string | null = null;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    // Generate random URL token
    const token = uuidv4().replace(/-/g, '').substring(0, 16);

    const shareLink = await this.prisma.shareLink.create({
      data: {
        token,
        role: dto.role,
        passwordHash,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        maxDownloads: dto.maxDownloads || null,
        fileId: dto.fileId || null,
        folderId: dto.folderId || null,
      },
    });

    return {
      shareLink: {
        ...shareLink,
        hasPassword: !!passwordHash,
        passwordHash: undefined,
      },
      shareUrl: `/api/sharing/public/${shareLink.token}`,
    };
  }

  /**
   * Resolve public share link
   */
  async resolvePublicLink(token: string, password?: string) {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      include: {
        file: true,
        folder: {
          include: {
            files: { where: { isTrashed: false } },
            subFolders: { where: { isTrashed: false } },
          },
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Shared link is invalid or expired');
    }

    // Check expiration
    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new ForbiddenException('This share link has expired');
    }

    // Check download limit
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      throw new ForbiddenException('Download limit for this link has been reached');
    }

    // Check password protection
    if (link.passwordHash) {
      if (!password) {
        return {
          requiresPassword: true,
          resourceType: link.fileId ? 'FILE' : 'FOLDER',
          name: link.file?.name || link.folder?.name,
        };
      }

      const isMatch = await bcrypt.compare(password, link.passwordHash);
      if (!isMatch) {
        throw new UnauthorizedException('Incorrect password for shared link');
      }
    }

    return {
      requiresPassword: false,
      role: link.role,
      file: link.file,
      folder: link.folder,
      expiresAt: link.expiresAt,
    };
  }

  /**
   * Download a public shared file
   */
  async downloadPublicFile(token: string, password?: string) {
    const resolved = await this.resolvePublicLink(token, password);
    if (resolved.requiresPassword) {
      throw new UnauthorizedException('Password required to download this file');
    }

    if (!resolved.file) {
      throw new BadRequestException('This link does not represent a direct file download');
    }

    const file = resolved.file;
    if (!this.storage.fileExists(file.storageKey)) {
      throw new NotFoundException('File missing on storage server');
    }

    // Increment download count
    await this.prisma.shareLink.update({
      where: { token },
      data: { downloadCount: { increment: 1 } },
    });

    const stream = this.storage.createReadStream(file.storageKey);
    return { stream, file };
  }
}
