import { Module } from '@nestjs/common';
import { RankingsController } from './rankings.controller';
import { RankingsService } from './rankings.service';
import { RatingService } from './rating.service';

@Module({
  controllers: [RankingsController],
  providers: [RankingsService, RatingService],
  exports: [RankingsService, RatingService],
})
export class RankingsModule {}
