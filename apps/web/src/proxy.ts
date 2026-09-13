import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // api, statik fayllar, OBS overlay va zal monitori i18n'dan tashqarida
  matcher: '/((?!api|_next|_vercel|overlay|screen|.*\\..*).*)',
};
