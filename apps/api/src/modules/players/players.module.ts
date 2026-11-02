import { Module } from '@nestjs/common';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';
import { PlayerPhotoService } from './player-photo.service';

@Module({
  controllers: [PlayersController],
  providers: [PlayersService, PlayerPhotoService],
  exports: [PlayersService],
})
export class PlayersModule {}
