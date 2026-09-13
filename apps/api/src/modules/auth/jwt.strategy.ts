import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type {
  AccessTokenPayload,
  AuthUser,
} from '../../common/types/auth-user';
import { ACCESS_COOKIE } from './auth.constants';

/** Access tokenni httpOnly cookie'dan (yoki Bearer headerdan) o'qiydi */
function extractToken(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  if (cookies?.[ACCESS_COOKIE]) return cookies[ACCESS_COOKIE];
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: extractToken,
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      issuer: 'uztt-api',
      audience: 'uztt-web',
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    return {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
