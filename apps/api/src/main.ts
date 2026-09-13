import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const isProd = config.get('NODE_ENV') === 'production';

  app.setGlobalPrefix('api');
  app.set('trust proxy', 1); // nginx orqasida to'g'ri IP olish uchun

  // HSTS'ni TLS'ni tugatuvchi nginx beradi (deploy/nginx.conf) — API uni
  // takrorlamaydi. API to'g'ridan-to'g'ri HTTP orqali ochilganda (lokal stack,
  // ichki tarmoq) HSTS brauzerda butun "localhost" uchun yoqilib qolardi va
  // undan keyin http://localhost:3100 ham ochilmay qolardi.
  app.use(helmet({ hsts: false }));
  app.use(cookieParser());

  // Diskvalifikatsiya ovozli yozuvlari (maxfiy emas — pasport hujjatlaridan farqli)
  app.useStaticAssets(join(process.cwd(), 'uploads', 'audio'), {
    prefix: '/audio/',
  });
  // Ommaviy media (rasm/hujjat). DIQQAT: uploads/private HECH QACHON serve qilinmaydi
  app.useStaticAssets(join(process.cwd(), 'uploads', 'public'), {
    prefix: '/uploads/',
    maxAge: '7d',
  });

  app.enableCors({
    origin: (config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO'da yo'q maydonlar olib tashlanadi
      forbidNonWhitelisted: true, // ...va xato qaytariladi (mass assignment himoyasi)
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (!isProd) {
    const doc = new DocumentBuilder()
      .setTitle('UZTT API')
      .setDescription("O'zbekiston Stol Tennisi Federatsiyasi — API hujjati")
      .setVersion('0.1')
      .addCookieAuth('uztt_at')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, doc),
    );
  }

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port);
  console.log(
    `UZTT API ishga tushdi: http://localhost:${port}/api (docs: /api/docs)`,
  );
}

void bootstrap();
