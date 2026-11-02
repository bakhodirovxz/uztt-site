import { Global, Module } from '@nestjs/common';
import { ShowcaseController } from './showcase.controller';
import { ShowcaseService } from './showcase.service';
import { TelegramService } from './telegram.service';

/** Global: istalgan modul Telegram e'lonlarini (TelegramService.announce) moduli import qilmasdan yubora oladi */
@Global()
@Module({
  controllers: [ShowcaseController],
  providers: [ShowcaseService, TelegramService],
  exports: [ShowcaseService, TelegramService],
})
export class ShowcaseModule {}
