import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs';

/**
 * Sekin so'rovlarni loglaydi (default: 500 ms dan uzun).
 * Maqsad — musobaqa kunida qaysi endpoint sekinlashayotganini darhol ko'rish.
 * Chegara: SLOW_REQUEST_MS (0 — o'chirilgan).
 */
@Injectable()
export class SlowRequestInterceptor implements NestInterceptor {
  private readonly logger = new Logger('SlowRequest');
  private readonly thresholdMs = Number(process.env.SLOW_REQUEST_MS ?? 500);

  intercept(context: ExecutionContext, next: CallHandler) {
    if (this.thresholdMs <= 0) return next.handle();

    const req = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
    }>();
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - started;
        if (ms >= this.thresholdMs) {
          this.logger.warn(
            `${ms}ms — ${req?.method ?? '?'} ${req?.originalUrl ?? req?.url ?? '?'}`,
          );
        }
      }),
    );
  }
}
