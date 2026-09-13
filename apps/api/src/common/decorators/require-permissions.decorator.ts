import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'requiredPermissions';

/**
 * Endpoint uchun kerakli permissionlar (hammasi bo'lishi shart).
 * Rollar emas, permissionlar tekshiriladi — yangi rol qo'shilganda kod o'zgarmaydi.
 *
 * @example @RequirePermissions('match.score')
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
