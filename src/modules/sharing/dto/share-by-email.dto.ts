import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionRole } from '@prisma/client';

export class ShareByEmailDto {
  @ApiProperty({ example: 'colleague@university.edu' })
  @IsEmail({}, { message: 'A valid user email address is required' })
  email: string;

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
}
