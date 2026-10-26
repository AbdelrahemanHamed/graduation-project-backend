import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FoldersService } from './folders.service.js';
import { CreateFolderDto } from './dto/create-folder.dto.js';
import { UpdateFolderDto } from './dto/update-folder.dto.js';
import { MoveFolderDto } from './dto/move-folder.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Folders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new folder' })
  async createFolder(@CurrentUser('id') userId: string, @Body() dto: CreateFolderDto) {
    return this.foldersService.createFolder(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get folder contents (subfolders and files), or root if folderId omitted' })
  @ApiQuery({ name: 'folderId', required: false, description: 'Folder ID or leave empty for root' })
  async getContents(
    @CurrentUser('id') userId: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.foldersService.getFolderContents(userId, folderId);
  }

  @Get('breadcrumbs/:id')
  @ApiOperation({ summary: 'Get breadcrumb navigation trail for a folder' })
  async getBreadcrumbs(@Param('id') folderId: string) {
    return this.foldersService.getBreadcrumbs(folderId);
  }

  @Get('starred')
  @ApiOperation({ summary: 'Get all starred folders' })
  async getStarred(@CurrentUser('id') userId: string) {
    return this.foldersService.getStarredFolders(userId);
  }

  @Get('trash')
  @ApiOperation({ summary: 'Get all trashed folders' })
  async getTrash(@CurrentUser('id') userId: string) {
    return this.foldersService.getTrashedFolders(userId);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move folder into another folder or root' })
  async moveFolder(
    @CurrentUser('id') userId: string,
    @Param('id') folderId: string,
    @Body() dto: MoveFolderDto,
  ) {
    return this.foldersService.moveFolder(userId, folderId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename folder or update color / star status' })
  async updateFolder(
    @CurrentUser('id') userId: string,
    @Param('id') folderId: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.foldersService.updateFolder(userId, folderId, dto);
  }

  @Delete(':id/trash')
  @ApiOperation({ summary: 'Soft delete (send to Trash)' })
  async trashFolder(@CurrentUser('id') userId: string, @Param('id') folderId: string) {
    return this.foldersService.trashFolder(userId, folderId);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore folder from Trash' })
  async restoreFolder(@CurrentUser('id') userId: string, @Param('id') folderId: string) {
    return this.foldersService.restoreFolder(userId, folderId);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete folder' })
  async deletePermanently(@CurrentUser('id') userId: string, @Param('id') folderId: string) {
    return this.foldersService.permanentlyDeleteFolder(userId, folderId);
  }
}
