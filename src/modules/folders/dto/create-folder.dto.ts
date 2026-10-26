import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFolderDto {
  @ApiProperty({ example: 'Graduation Documents' })
  @IsString()
  @IsNotEmpty({ message: 'Folder name cannot be empty' })
  name: string;

  @ApiPropertyOptional({ example: 'uuid-parent-folder-id', description: 'Leave empty for root level' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: '#4285F4', description: 'HEX color for folder icon' })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Color must be a valid 6-character hex code (e.g. #4285F4)' })
  color?: string;
}
