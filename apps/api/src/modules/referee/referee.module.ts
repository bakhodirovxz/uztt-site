import { Module } from '@nestjs/common';
import { RefereeController } from './referee.controller';

@Module({
  controllers: [RefereeController],
})
export class RefereeModule {}
