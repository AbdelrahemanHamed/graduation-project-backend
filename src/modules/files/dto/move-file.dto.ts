import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MoveFileDto {
  @ApiPropertyOptional({
    example: 'target-folder-id',
    description: 'Target folder ID, or null/undefined to move to root directory',
  })
  @IsOptional()
  @IsString()
  targetFolderId?: string | null;
}
