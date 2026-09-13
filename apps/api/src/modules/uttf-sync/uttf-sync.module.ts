import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UttfSyncController } from './uttf-sync.controller';
import { UttfSyncService } from './uttf-sync.service';

@Module({
  imports: [PrismaModule],
  controllers: [UttfSyncController],
  providers: [UttfSyncService],
})
export class UttfSyncModule {}
