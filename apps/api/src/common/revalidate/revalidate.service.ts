import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Kontent teglari — web sahifalar shu nomlar bilan keshlanadi */
export type RevalidateTag =
  'news' | 'pages' | 'federation' | 'media' | 'tournaments';

/**
 * Admin kontentni o'zgartirganda Next.js keshini yangilash signali.
 * "Fire and forget": web javob bermasa ham admin amali muvaffaqiyatli qoladi —
 * sahifa baribir `revalidate` muddati o'tgach yangilanadi.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);

  constructor(private readonly config: ConfigService) {}

  trigger(tags: RevalidateTag[]): void {
    const url = this.config.get<string>('WEB_REVALIDATE_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!url || !secret || tags.length === 0) return;

    void fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': secret,
      },
      body: JSON.stringify({ tags }),
    })
      .then((res) => {
        if (!res.ok) {
          this.logger.warn(
            `Revalidate javobi ${res.status} (${tags.join(', ')})`,
          );
        }
      })
      .catch((e: unknown) => {
        this.logger.warn(
          `Revalidate chaqiruvi muvaffaqiyatsiz: ${e instanceof Error ? e.message : String(e)}`,
        );
      });
  }
}
