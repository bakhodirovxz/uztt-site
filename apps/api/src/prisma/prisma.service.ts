import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Sekin so'rovlarni loglash chegarasi (ms). 0 yoki berilmagan — o'chirilgan. */
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS ?? 0);

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Query eventlari faqat kerak bo'lganda yoqiladi — har so'rovni
    // kuzatish production'da ortiqcha yuk beradi.
    super(
      SLOW_QUERY_MS > 0
        ? { log: [{ emit: 'event', level: 'query' }] }
        : { log: ['warn', 'error'] },
    );
  }

  async onModuleInit() {
    if (SLOW_QUERY_MS > 0) {
      this.$on('query', (e) => {
        if (e.duration >= SLOW_QUERY_MS) {
          this.logger.warn(`${e.duration}ms — ${e.query.slice(0, 300)}`);
        }
      });
      this.logger.log(`Sekin so'rov logi yoqildi: >= ${SLOW_QUERY_MS}ms`);
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
