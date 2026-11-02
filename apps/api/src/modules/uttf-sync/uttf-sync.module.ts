import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UttfSyncController } from './uttf-sync.controller';
import { UttfSyncService } from './uttf-sync.service';
import { UttfContentService } from './uttf-content.service';

@Module({
  imports: [PrismaModule],
  controllers: [UttfSyncController],
  providers: [UttfSyncService, UttfContentService],
})
export class UttfSyncModule {}
