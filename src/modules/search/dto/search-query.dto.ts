import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum FileTypeFilter {
  ALL = 'all',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  AUDIO = 'audio',
}

export class SearchQueryDto {
  @ApiPropertyOptional({ example: 'project presentation' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ enum: FileTypeFilter, default: FileTypeFilter.ALL })
  @IsOptional()
  @IsEnum(FileTypeFilter)
  type?: FileTypeFilter = FileTypeFilter.ALL;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isStarred?: boolean;

  @ApiPropertyOptional({ example: 'folder-id' })
  @IsOptional()
  @IsString()
  folderId?: string;
}
