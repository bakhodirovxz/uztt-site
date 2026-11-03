import { Global, Module } from '@nestjs/common';
import { AssignmentController } from './assignment.controller';
import { AssignmentService } from './assignment.service';
import { TableAssignService } from './table-assign.service';

/** Global: setka/guruh/o'yin modullari sikl hosil qilmasdan servisni oladi */
@Global()
@Module({
  controllers: [AssignmentController],
  providers: [AssignmentService, TableAssignService],
  exports: [AssignmentService, TableAssignService],
})
export class AssignmentModule {}
