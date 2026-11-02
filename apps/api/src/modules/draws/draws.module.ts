import { Module } from '@nestjs/common';
import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

@Module({
  controllers: [DrawsController, GroupsController],
  providers: [DrawsService, GroupsService],
  exports: [DrawsService, GroupsService],
})
export class DrawsModule {}
