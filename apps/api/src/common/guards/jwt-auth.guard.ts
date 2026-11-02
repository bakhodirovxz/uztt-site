import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PASSWORD_CHANGE_KEY } from '../decorators/allow-password-change.decorator';
import type { AuthUser } from '../types/auth-user';

/**
 * Global autentifikatsiya guard'i. Default — hamma endpoint himoyalangan;
 * ochiq endpointlar @Public() bilan belgilanadi (secure-by-default).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  /** Boshlang'ich parol bilan kirgan foydalanuvchi parolni almashtirmaguncha hech narsa qila olmaydi */
  handleRequest<T = AuthUser>(err: unknown, user: T, info: unknown, context: ExecutionContext): T {
    const u = super.handleRequest(err, user, info, context) as AuthUser;
    if (u?.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_PASSWORD_CHANGE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException({ code: 'PASSWORD_CHANGE_REQUIRED', message: 'Avval parolni almashtiring' });
      }
    }
    return u as T;
  }
}
