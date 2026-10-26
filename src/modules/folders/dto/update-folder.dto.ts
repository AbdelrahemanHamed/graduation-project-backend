import { IsOptional, IsString, Matches, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateFolderDto {
  @ApiPropertyOptional({ example: 'Renamed Project Folder' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '#EA4335' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color must be a valid 6-character hex code' })
  color?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isStarred?: boolean;
}
