import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import type { AuthUser } from '../types/auth-user';

/**
 * Permission-asosli avtorizatsiya. @RequirePermissions('news.publish') bilan
 * belgilangan endpointga faqat shu permissionga ega user kiradi.
 * SUPERADMIN roli hamma permissionni avtomatik oladi (seed'da to'liq to'plam).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('Avtorizatsiya talab qilinadi');

    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length > 0) {
      throw new ForbiddenException(
        `Ruxsat yetarli emas: ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
