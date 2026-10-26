import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ActivityAction, ResourceType } from '@prisma/client';

export interface LogActivityParams {
  userId: string;
  action: ActivityAction;
  resourceType: ResourceType;
  resourceId: string;
  details?: Record<string, any>;
}

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: LogActivityParams) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId: params.userId,
          action: params.action,
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          details: params.details || {},
        },
      });
    } catch {
      // Activity logging failure should never crash the main operation
    }
  }

  async getUserRecentActivity(userId: string, limit = 20) {
    return this.prisma.activityLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}
