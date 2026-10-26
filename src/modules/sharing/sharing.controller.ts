import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { SharingService } from './sharing.service.js';
import { ShareByEmailDto } from './dto/share-by-email.dto.js';
import { CreateShareLinkDto } from './dto/create-share-link.dto.js';
import { VerifyLinkPasswordDto } from './dto/verify-link-password.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Sharing & Collaboration')
@Controller('sharing')
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Post('email')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Share file or folder with a user by email (Viewer or Editor)' })
  async shareByEmail(
    @CurrentUser('id') userId: string,
    @Body() dto: ShareByEmailDto,
  ) {
    return this.sharingService.shareByEmail(userId, dto);
  }

  @Delete('access/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Revoke shared access from a collaborator' })
  async revokeAccess(
    @CurrentUser('id') userId: string,
    @Param('id') shareId: string,
  ) {
    return this.sharingService.revokeAccess(userId, shareId);
  }

  @Get('collaborators')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List collaborators for a file or folder' })
  @ApiQuery({ name: 'fileId', required: false })
  @ApiQuery({ name: 'folderId', required: false })
  async listCollaborators(
    @CurrentUser('id') userId: string,
    @Query('fileId') fileId?: string,
    @Query('folderId') folderId?: string,
  ) {
    return this.sharingService.listCollaborators(userId, fileId, folderId);
  }

  @Get('shared-with-me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get files and folders shared with current user' })
  async getSharedWithMe(@CurrentUser('id') userId: string) {
    return this.sharingService.getSharedWithMe(userId);
  }

  @Post('link')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a public shareable URL link with optional password & expiration' })
  async createShareLink(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateShareLinkDto,
  ) {
    return this.sharingService.createShareLink(userId, dto);
  }

  @Post('public/:token')
  @ApiOperation({ summary: 'Access a public share link (supports optional password in body)' })
  async resolvePublic(
    @Param('token') token: string,
    @Body() dto?: VerifyLinkPasswordDto,
  ) {
    return this.sharingService.resolvePublicLink(token, dto?.password);
  }

  @Post('public/:token/download')
  @ApiOperation({ summary: 'Download a file via public share link' })
  async downloadPublic(
    @Param('token') token: string,
    @Body() dto: VerifyLinkPasswordDto,
    @Res() res: Response,
  ) {
    const { stream, file } = await this.sharingService.downloadPublicFile(token, dto?.password);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Length', file.size.toString());
    stream.pipe(res);
  }
}
