import { Prisma } from '@prisma/client';

/**
 * Unique cheklov buzilgan bo'lsa, qaysi ustunlar ekanini qaytaradi.
 * Poyga holatlarida (bir vaqtda bir xil slug/litsenziya) 500 o'rniga
 * mazmunli javob berish uchun ishlatiladi.
 */
export function uniqueViolationTarget(e: unknown): string[] | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
    const target = (e.meta as { target?: string[] | string } | undefined)
      ?.target;
    if (Array.isArray(target)) return target;
    if (typeof target === 'string') return [target];
    return [];
  }
  return null;
}
