import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveFolderDto {
  @ApiPropertyOptional({
    example: 'target-parent-folder-id',
    description: 'Target folder ID, or null/undefined to move to root directory',
  })
  @IsOptional()
  @IsString()
  targetParentId?: string | null;
}
