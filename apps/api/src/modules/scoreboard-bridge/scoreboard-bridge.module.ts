import { Module } from '@nestjs/common';
import { MatchesModule } from '../matches/matches.module';
import { ScoreboardBridgeController } from './scoreboard-bridge.controller';
import { ScoreboardBridgeService } from './scoreboard-bridge.service';

@Module({
  imports: [MatchesModule],
  controllers: [ScoreboardBridgeController],
  providers: [ScoreboardBridgeService],
})
export class ScoreboardBridgeModule {}
