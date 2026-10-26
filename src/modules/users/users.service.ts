import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  /**
   * Search users by partial email or name (excluding the current user)
   * Essential for Google Drive collaborator search autocomplete
   */
  async searchUsers(query: string, currentUserId: string) {
    if (!query || query.trim().length === 0) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        OR: [
          { email: { contains: query.trim(), mode: 'insensitive' } },
          { name: { contains: query.trim(), mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
      },
      take: 10,
    });
  }

  /**
   * Returns storage quota analytics broken down by category (Images, Videos, Documents, Other)
   */
  async getStorageAnalytics(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        storageUsed: true,
        storageLimit: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const files = await this.prisma.file.findMany({
      where: { ownerId: userId, isTrashed: false },
      select: { mimeType: true, size: true },
    });

    let imagesBytes = BigInt(0);
    let videosBytes = BigInt(0);
    let documentsBytes = BigInt(0);
    let othersBytes = BigInt(0);

    for (const f of files) {
      const mime = f.mimeType.toLowerCase();
      if (mime.startsWith('image/')) {
        imagesBytes += f.size;
      } else if (mime.startsWith('video/')) {
        videosBytes += f.size;
      } else if (
        mime.includes('pdf') ||
        mime.includes('document') ||
        mime.includes('word') ||
        mime.includes('text') ||
        mime.includes('sheet')
      ) {
        documentsBytes += f.size;
      } else {
        othersBytes += f.size;
      }
    }

    const used = Number(user.storageUsed);
    const limit = Number(user.storageLimit);
    const percentage = limit > 0 ? ((used / limit) * 100).toFixed(2) : '0';

    return {
      storageUsed: Number(user.storageUsed),
      storageLimit: Number(user.storageLimit),
      usedPercentage: Number(percentage),
      breakdown: {
        images: Number(imagesBytes),
        videos: Number(videosBytes),
        documents: Number(documentsBytes),
        others: Number(othersBytes),
      },
    };
  }
}
