import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { LevelsController } from './levels.controller';
import { TournamentsService } from './tournaments.service';

@Module({
  controllers: [TournamentsController, LevelsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
