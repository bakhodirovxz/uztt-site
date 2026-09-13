import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs';
import { REVALIDATE_TAGS_KEY } from './revalidate.decorator';
import { RevalidateService, type RevalidateTag } from './revalidate.service';

/** @Revalidates(...) bilan belgilangan mutatsiyalardan keyin keshni yangilaydi */
@Injectable()
export class RevalidateInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly revalidate: RevalidateService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const tags = this.reflector.getAllAndOverride<RevalidateTag[]>(
      REVALIDATE_TAGS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const method = context
      .switchToHttp()
      .getRequest<{ method: string }>()?.method;

    if (!tags?.length || !method || method === 'GET') {
      return next.handle();
    }
    // Xatolik bo'lsa tap ishlamaydi — bekor bo'lgan amal keshni yangilamaydi
    return next.handle().pipe(tap(() => this.revalidate.trigger(tags)));
  }
}
