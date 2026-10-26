import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ActivityService } from './activity.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('recent')
  @ApiOperation({ summary: 'Get recent activity/audit logs for logged in user' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getRecent(@CurrentUser('id') userId: string, @Query('limit') limit?: string) {
    const take = limit ? Math.min(parseInt(limit, 10), 100) : 20;
    return this.activityService.getUserRecentActivity(userId, take);
  }
}
