import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { FoldersModule } from './modules/folders/folders.module.js';
import { FilesModule } from './modules/files/files.module.js';
import { SharingModule } from './modules/sharing/sharing.module.js';
import { SearchModule } from './modules/search/search.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    StorageModule,
    ActivityModule,
    AuthModule,
    UsersModule,
    FoldersModule,
    FilesModule,
    SharingModule,
    SearchModule,
  ],
})
export class AppModule {}
