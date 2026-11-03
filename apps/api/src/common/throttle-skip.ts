import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

const PRIVATE_IP = /^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^::1$/;

/**
 * Sayt serverining o'z so'rovlari (SSR, scoreboard): ular Docker tarmog'idan, X-Forwarded-For'siz keladi.
 * Hisoblansa, hamma tomoshabin bitta "IP" bo'lib qolardi va 300 so'rov/daqiqadan keyin sahifalar yiqilardi.
 * Tashqi so'rov buni soxtalashtira olmaydi: API porti faqat 127.0.0.1 da, nginx esa har doim XFF qo'shadi.
 */
export function isInternalRequest(req: Pick<Request, 'ip' | 'headers'>): boolean {
  return !req.headers['x-forwarded-for'] && PRIVATE_IP.test(req.ip ?? '');
}

export function skipInternal(context: ExecutionContext): boolean {
  if (context.getType() !== 'http') return false;
  return isInternalRequest(context.switchToHttp().getRequest<Request>());
}
