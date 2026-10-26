import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesService } from './files.service.js';
import { UpdateFileDto } from './dto/update-file.dto.js';
import { MoveFileDto } from './dto/move-file.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a file (images, PDFs, videos, documents)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folderId: { type: 'string', nullable: true },
      },
    },
  })
  async upload(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('folderId') folderId?: string,
  ) {
    return this.filesService.uploadFile(userId, file, folderId);
  }

  @Get('starred')
  @ApiOperation({ summary: 'Get all starred files' })
  async getStarred(@CurrentUser('id') userId: string) {
    return this.filesService.getStarredFiles(userId);
  }

  @Get('trash')
  @ApiOperation({ summary: 'Get all trashed files' })
  async getTrash(@CurrentUser('id') userId: string) {
    return this.filesService.getTrashedFiles(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file details' })
  async getDetails(@CurrentUser('id') userId: string, @Param('id') fileId: string) {
    return this.filesService.getFile(fileId, userId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download file' })
  async download(
    @CurrentUser('id') userId: string,
    @Param('id') fileId: string,
    @Res() res: Response,
  ) {
    const { stream, file } = await this.filesService.getFileDownload(fileId, userId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader('Content-Length', file.size.toString());
    stream.pipe(res);
  }

  @Get(':id/stream')
  @ApiOperation({ summary: 'Stream video/audio file with HTTP Range 206 Partial Content' })
  async stream(
    @CurrentUser('id') userId: string,
    @Param('id') fileId: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    const result = await this.filesService.streamMedia(fileId, userId, range);
    if (!result.stream) {
      return res.status(result.status).set(result.headers).end();
    }
    res.status(result.status).set(result.headers);
    result.stream.pipe(res);
  }

  @Patch(':id/move')
  @ApiOperation({ summary: 'Move file to another folder or root' })
  async move(
    @CurrentUser('id') userId: string,
    @Param('id') fileId: string,
    @Body() dto: MoveFileDto,
  ) {
    return this.filesService.moveFile(userId, fileId, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename or star/unstar file' })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') fileId: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.filesService.updateFile(userId, fileId, dto);
  }

  @Delete(':id/trash')
  @ApiOperation({ summary: 'Move file to Trash' })
  async trash(@CurrentUser('id') userId: string, @Param('id') fileId: string) {
    return this.filesService.trashFile(userId, fileId);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore file from Trash' })
  async restore(@CurrentUser('id') userId: string, @Param('id') fileId: string) {
    return this.filesService.restoreFile(userId, fileId);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete file and reclaim quota' })
  async deletePermanently(@CurrentUser('id') userId: string, @Param('id') fileId: string) {
    return this.filesService.permanentlyDeleteFile(userId, fileId);
  }
}
