import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search users by email or name for collaboration sharing' })
  @ApiQuery({ name: 'q', required: true, description: 'Search term for email or name' })
  async search(@Query('q') query: string, @CurrentUser('id') currentUserId: string) {
    return this.usersService.searchUsers(query, currentUserId);
  }

  @Get('storage-stats')
  @ApiOperation({ summary: 'Get current storage usage analytics and breakdown' })
  async getStorageStats(@CurrentUser('id') userId: string) {
    return this.usersService.getStorageAnalytics(userId);
  }
}
