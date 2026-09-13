import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { RevalidateModule } from './common/revalidate/revalidate.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlayersModule } from './modules/players/players.module';
import { TournamentsModule } from './modules/tournaments/tournaments.module';
import { MatchesModule } from './modules/matches/matches.module';
import { LiveModule } from './modules/live/live.module';
import { RankingsModule } from './modules/rankings/rankings.module';
import { UttfSyncModule } from './modules/uttf-sync/uttf-sync.module';
import { NewsModule } from './modules/news/news.module';
import { RegistrationModule } from './modules/registration/registration.module';
import { DrawsModule } from './modules/draws/draws.module';
import { ContentModule } from './modules/content/content.module';
import { RolesModule } from './modules/roles/roles.module';
import { CoachModule } from './modules/coach/coach.module';
import { StreamModule } from './modules/stream/stream.module';
import { RefereeModule } from './modules/referee/referee.module';
import { UsersModule } from './modules/users/users.module';
import { HealthController } from './modules/health/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { CacheControlInterceptor } from './common/interceptors/cache-control.interceptor';
import { SlowRequestInterceptor } from './common/interceptors/slow-request.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['.env', '../../.env'],
    }),
    // Global chegara sozlanadigan: musobaqa zalida yuzlab tomoshabin bitta
    // NAT orqasidan kiradi — o'sha IP uchun 100/daq juda tor. Sezgir
    // endpointlar (login, hakam kodi, aloqa formasi) o'z chegarasini saqlaydi.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
        limit: Number(process.env.THROTTLE_LIMIT ?? 300),
      },
    ]),
    // Rejalashtirilgan vazifalar (haftalik reyting kesimi)
    ScheduleModule.forRoot(),
    PrismaModule,
    CryptoModule,
    RevalidateModule,
    AuthModule,
    PlayersModule,
    TournamentsModule,
    MatchesModule,
    LiveModule,
    RankingsModule,
    UttfSyncModule,
    NewsModule,
    RegistrationModule,
    DrawsModule,
    ContentModule,
    RolesModule,
    CoachModule,
    StreamModule,
    RefereeModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guard tartibi muhim: throttle → CSRF → autentifikatsiya → avtorizatsiya
    { provide: APP_INTERCEPTOR, useClass: SlowRequestInterceptor },
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
