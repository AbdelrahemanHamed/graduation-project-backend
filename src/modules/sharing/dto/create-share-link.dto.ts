import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { PermissionRole } from '@prisma/client';

export class CreateShareLinkDto {
  @ApiPropertyOptional({ example: 'uuid-file-id' })
  @IsOptional()
  @IsString()
  fileId?: string;

  @ApiPropertyOptional({ example: 'uuid-folder-id' })
  @IsOptional()
  @IsString()
  folderId?: string;

  @ApiProperty({ enum: PermissionRole, default: PermissionRole.VIEWER })
  @IsEnum(PermissionRole)
  role: PermissionRole;

  @ApiPropertyOptional({ example: 'secret123', description: 'Optional password to access link' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Expiration date ISO string' })
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: 10, description: 'Maximum allowed downloads' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxDownloads?: number;
}
