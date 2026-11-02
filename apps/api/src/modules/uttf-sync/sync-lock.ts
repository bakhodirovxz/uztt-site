import { ConflictException } from '@nestjs/common';

/**
 * Jarayon ichidagi (in-process) qulf: bir xil sinxronizatsiya bo'limi bir vaqtda ikki marta ishlamasin.
 * Admin 504 olib (nginx 60 s) qayta bossa, birinchi ish hali davom etayotgan bo'ladi — ikkinchisi 409 oladi.
 * Eslatma: bitta API nusxasi (replica) uchun; bir nechta nusxada DB/Redis qulfi kerak bo'ladi.
 */
export class SyncLock {
  private readonly running = new Map<string, number>();

  isRunning(scope: string): boolean {
    return this.running.has(scope);
  }

  async run<T>(scope: string, fn: () => Promise<T>): Promise<T> {
    const since = this.running.get(scope);
    if (since !== undefined) {
      const s = Math.round((Date.now() - since) / 1000);
      throw new ConflictException(
        `"${scope}" sinxronizatsiyasi allaqachon ishlayapti (${s} soniyadan beri) — tugashini kuting va qayta urinib ko'ring`,
      );
    }
    this.running.set(scope, Date.now());
    try {
      return await fn();
    } finally {
      this.running.delete(scope);
    }
  }
}
