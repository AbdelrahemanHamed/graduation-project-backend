import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityService } from '../activity/activity.service.js';
import { CreateFolderDto } from './dto/create-folder.dto.js';
import { UpdateFolderDto } from './dto/update-folder.dto.js';
import { MoveFolderDto } from './dto/move-folder.dto.js';
import { ActivityAction, PermissionRole, ResourceType } from '@prisma/client';

@Injectable()
export class FoldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
  ) {}

  /**
   * Helper to verify user has read or write access to folder
   */
  async checkFolderAccess(
    folderId: string,
    userId: string,
    requiredRole: 'VIEWER' | 'EDITOR' = 'VIEWER',
  ) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        sharedAccesses: {
          where: { userId },
        },
      },
    });

    if (!folder) {
      throw new NotFoundException('Folder not found');
    }

    if (folder.ownerId === userId) {
      return { folder, isOwner: true, role: 'OWNER' as const };
    }

    const share = folder.sharedAccesses[0];
    if (!share) {
      throw new ForbiddenException('You do not have access to this folder');
    }

    if (requiredRole === 'EDITOR' && share.role === PermissionRole.VIEWER) {
      throw new ForbiddenException('You only have Viewer permission on this folder');
    }

    return { folder, isOwner: false, role: share.role };
  }

  /**
   * Create folder (at root or nested)
   */
  async createFolder(userId: string, dto: CreateFolderDto) {
    if (dto.parentId) {
      await this.checkFolderAccess(dto.parentId, userId, 'EDITOR');
    }

    const folder = await this.prisma.folder.create({
      data: {
        name: dto.name.trim(),
        color: dto.color || '#4285F4',
        parentId: dto.parentId || null,
        ownerId: userId,
      },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.UPLOAD,
      resourceType: ResourceType.FOLDER,
      resourceId: folder.id,
      details: { name: folder.name, parentId: folder.parentId },
    });

    return folder;
  }

  /**
   * Get folder contents (subfolders + files)
   * If folderId is undefined/null, gets root items
   */
  async getFolderContents(userId: string, folderId?: string) {
    let currentFolder: any = null;
    let breadcrumbs: Array<{ id: string; name: string }> = [];

    if (folderId) {
      const access = await this.checkFolderAccess(folderId, userId, 'VIEWER');
      currentFolder = access.folder;
      breadcrumbs = await this.getBreadcrumbs(folderId);
    }

    const whereFolder = {
      ownerId: userId,
      parentId: folderId || null,
      isTrashed: false,
    };

    const whereFiles = {
      ownerId: userId,
      folderId: folderId || null,
      isTrashed: false,
    };

    const [folders, files] = await Promise.all([
      this.prisma.folder.findMany({
        where: whereFolder,
        orderBy: [{ isStarred: 'desc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { files: true, subFolders: true },
          },
        },
      }),
      this.prisma.file.findMany({
        where: whereFiles,
        orderBy: [{ isStarred: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      currentFolder,
      breadcrumbs,
      folders,
      files,
    };
  }

  /**
   * Calculate breadcrumbs trail up to root
   */
  async getBreadcrumbs(folderId: string): Promise<Array<{ id: string; name: string }>> {
    const crumbs: Array<{ id: string; name: string }> = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = await this.prisma.folder.findUnique({
        where: { id: currentId },
        select: { id: true, name: true, parentId: true },
      });

      if (!folder) break;
      crumbs.unshift({ id: folder.id, name: folder.name });
      currentId = folder.parentId;
    }

    return crumbs;
  }

  /**
   * Move folder to another folder (or root)
   * Prevents cyclic move: cannot move folder inside itself or its own descendants!
   */
  async moveFolder(userId: string, folderId: string, dto: MoveFolderDto) {
    const { folder } = await this.checkFolderAccess(folderId, userId, 'EDITOR');

    const targetParentId = dto.targetParentId || null;

    if (folder.parentId === targetParentId) {
      return folder; // No change
    }

    if (targetParentId === folderId) {
      throw new BadRequestException('Cannot move a folder into itself');
    }

    if (targetParentId) {
      await this.checkFolderAccess(targetParentId, userId, 'EDITOR');

      // Cycle detection: ensure targetParentId is not a descendant of folderId
      let checkId: string | null = targetParentId;
      while (checkId) {
        if (checkId === folderId) {
          throw new BadRequestException('Cannot move a folder into one of its own subfolders');
        }
        const parent = await this.prisma.folder.findUnique({
          where: { id: checkId },
          select: { parentId: true },
        });
        checkId = parent?.parentId || null;
      }
    }

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: { parentId: targetParentId },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.MOVE,
      resourceType: ResourceType.FOLDER,
      resourceId: folderId,
      details: { fromParentId: folder.parentId, toParentId: targetParentId },
    });

    return updated;
  }

  /**
   * Rename or update folder appearance
   */
  async updateFolder(userId: string, folderId: string, dto: UpdateFolderDto) {
    await this.checkFolderAccess(folderId, userId, 'EDITOR');

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.color ? { color: dto.color } : {}),
        ...(dto.isStarred !== undefined ? { isStarred: dto.isStarred } : {}),
      },
    });

    if (dto.name) {
      await this.activity.log({
        userId,
        action: ActivityAction.RENAME,
        resourceType: ResourceType.FOLDER,
        resourceId: folderId,
        details: { newName: dto.name },
      });
    }

    return updated;
  }

  /**
   * Move folder to trash (soft delete)
   */
  async trashFolder(userId: string, folderId: string) {
    await this.checkFolderAccess(folderId, userId, 'EDITOR');

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        isTrashed: true,
        trashedAt: new Date(),
      },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.DELETE,
      resourceType: ResourceType.FOLDER,
      resourceId: folderId,
    });

    return updated;
  }

  /**
   * Restore folder from trash
   */
  async restoreFolder(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.ownerId !== userId) {
      throw new NotFoundException('Folder not found');
    }

    const updated = await this.prisma.folder.update({
      where: { id: folderId },
      data: {
        isTrashed: false,
        trashedAt: null,
      },
    });

    await this.activity.log({
      userId,
      action: ActivityAction.RESTORE,
      resourceType: ResourceType.FOLDER,
      resourceId: folderId,
    });

    return updated;
  }

  /**
   * Permanently delete folder and all nested contents
   */
  async permanentlyDeleteFolder(userId: string, folderId: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder || folder.ownerId !== userId) {
      throw new NotFoundException('Folder not found');
    }

    return this.prisma.folder.delete({
      where: { id: folderId },
    });
  }

  /**
   * Get all starred folders
   */
  async getStarredFolders(userId: string) {
    return this.prisma.folder.findMany({
      where: { ownerId: userId, isStarred: true, isTrashed: false },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get trashed folders
   */
  async getTrashedFolders(userId: string) {
    return this.prisma.folder.findMany({
      where: { ownerId: userId, isTrashed: true },
      orderBy: { trashedAt: 'desc' },
    });
  }
}
