import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SearchQueryDto, FileTypeFilter } from './dto/search-query.dto.js';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, dto: SearchQueryDto) {
    const searchTerm = dto.q?.trim();

    // Folder search filter
    const folderWhere: any = {
      ownerId: userId,
      isTrashed: false,
    };

    if (searchTerm) {
      folderWhere.name = { contains: searchTerm, mode: 'insensitive' };
    }

    if (dto.isStarred !== undefined) {
      folderWhere.isStarred = dto.isStarred;
    }

    // File search filter
    const fileWhere: any = {
      ownerId: userId,
      isTrashed: false,
    };

    if (searchTerm) {
      fileWhere.name = { contains: searchTerm, mode: 'insensitive' };
    }

    if (dto.isStarred !== undefined) {
      fileWhere.isStarred = dto.isStarred;
    }

    if (dto.folderId) {
      fileWhere.folderId = dto.folderId;
    }

    // Filter by category mime types
    if (dto.type && dto.type !== FileTypeFilter.ALL) {
      switch (dto.type) {
        case FileTypeFilter.IMAGE:
          fileWhere.mimeType = { startsWith: 'image/' };
          break;
        case FileTypeFilter.VIDEO:
          fileWhere.mimeType = { startsWith: 'video/' };
          break;
        case FileTypeFilter.AUDIO:
          fileWhere.mimeType = { startsWith: 'audio/' };
          break;
        case FileTypeFilter.DOCUMENT:
          fileWhere.OR = [
            { mimeType: { contains: 'pdf' } },
            { mimeType: { contains: 'document' } },
            { mimeType: { contains: 'word' } },
            { mimeType: { contains: 'sheet' } },
            { mimeType: { contains: 'text' } },
          ];
          break;
      }
    }

    // Only search folders if type filter is ALL or omitted
    const searchFolders = !dto.type || dto.type === FileTypeFilter.ALL;

    const [folders, files] = await Promise.all([
      searchFolders
        ? this.prisma.folder.findMany({
            where: folderWhere,
            orderBy: { name: 'asc' },
            take: 20,
          })
        : Promise.resolve([]),
      this.prisma.file.findMany({
        where: fileWhere,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      }),
    ]);

    return {
      query: searchTerm || '',
      typeFilter: dto.type,
      totalFolders: folders.length,
      totalFiles: files.length,
      folders,
      files,
    };
  }
}
