import { Module } from '@nestjs/common';
import { SharingService } from './sharing.service.js';
import { SharingController } from './sharing.controller.js';

@Module({
  controllers: [SharingController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule {}
