import { SetMetadata } from '@nestjs/common';
import type { RevalidateTag } from './revalidate.service';

export const REVALIDATE_TAGS_KEY = 'revalidate:tags';

/**
 * Kontroller (yoki alohida endpoint) o'zgartiradigan kontent teglari.
 * Faqat mutatsiyalarda (GET emas) va faqat handler muvaffaqiyatli tugagach
 * web keshiga signal yuboriladi.
 */
export const Revalidates = (...tags: RevalidateTag[]) =>
  SetMetadata(REVALIDATE_TAGS_KEY, tags);
