import { Module } from '@nestjs/common';
import { FoldersService } from './folders.service.js';
import { FoldersController } from './folders.controller.js';

@Module({
  controllers: [FoldersController],
  providers: [FoldersService],
  exports: [FoldersService],
})
export class FoldersModule {}
