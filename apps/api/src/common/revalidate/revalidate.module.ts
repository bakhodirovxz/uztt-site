import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RevalidateService } from './revalidate.service';
import { RevalidateInterceptor } from './revalidate.interceptor';

/** Global — har qanday kontroller @Revalidates(...) bilan keshni yangilay oladi */
@Global()
@Module({
  providers: [
    RevalidateService,
    { provide: APP_INTERCEPTOR, useClass: RevalidateInterceptor },
  ],
  exports: [RevalidateService],
})
export class RevalidateModule {}
