import { Global, Module } from '@nestjs/common';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';

/** Global: setka/guruh/o'yin modullari sikl hosil qilmasdan servisni oladi */
@Global()
@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService],
  exports: [AssignmentService],
})
export class AssignmentModule {}
