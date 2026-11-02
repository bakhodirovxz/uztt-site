import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { LiveModule } from '../live/live.module';
import { ShowcaseModule } from '../showcase/showcase.module';

@Module({
  imports: [LiveModule, ShowcaseModule],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
