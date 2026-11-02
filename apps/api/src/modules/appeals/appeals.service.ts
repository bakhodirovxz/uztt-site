import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AppealKind, AppealStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AppealsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Apellyatsiya/protest berish. Reyting apellyatsiyasi — Nizom 44; protestlar — qoidalar 3.3.3–3.3.5:
   * faqat shu uchrashuvda qatnashgan o'yinchi, o'yin faktiga emas (talqin/tashkiliy masalaga) beriladi.
   */
  async create(userId: string, dto: { kind: AppealKind; matchId?: string; text: string }) {
    const player = await this.prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!player) throw new ForbiddenException("Apellyatsiya faqat o'yinchi kabinetidan beriladi");

    if (dto.kind !== 'RATING') {
      if (!dto.matchId) throw new BadRequestException('Protest uchun o‘yin (matchId) ko‘rsatilishi shart');
      const match = await this.prisma.match.findUnique({
        where: { id: dto.matchId },
        select: { player1Id: true, player2Id: true },
      });
      if (!match) throw new NotFoundException("O'yin topilmadi");
      if (match.player1Id !== player.id && match.player2Id !== player.id) {
        throw new ForbiddenException("Protestni faqat shu uchrashuvda qatnashgan o'yinchi bera oladi (3.3.5)");
      }
    }
    const dup = await this.prisma.appeal.count({
      where: { playerId: player.id, kind: dto.kind, matchId: dto.matchId ?? null, status: 'NEW' },
    });
    if (dup > 0) throw new ConflictException("Shu mavzuda ko'rib chiqilayotgan murojaat allaqachon bor");
    return this.prisma.appeal.create({
      data: { kind: dto.kind, playerId: player.id, matchId: dto.matchId ?? null, text: dto.text.trim() },
    });
  }

  async mine(userId: string) {
    const player = await this.prisma.player.findUnique({ where: { userId }, select: { id: true } });
    if (!player) return [];
    return this.prisma.appeal.findMany({ where: { playerId: player.id }, orderBy: { createdAt: 'desc' } });
  }

  list(status?: AppealStatus) {
    return this.prisma.appeal.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { player: { select: { id: true, firstName: true, lastName: true, region: true } } },
    });
  }

  /** Qaror (yakuniy). Reyting bo'yicha qanoatlantirilsa — bonus/jarima/tuzatish endpointlari orqali qo'llanadi. */
  async decide(id: string, userId: string, status: Exclude<AppealStatus, 'NEW'>, decision: string) {
    const a = await this.prisma.appeal.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Murojaat topilmadi');
    if (a.status !== 'NEW') throw new ConflictException('Qaror allaqachon qabul qilingan (yakuniy)');
    return this.prisma.appeal.update({
      where: { id },
      data: { status, decision: decision.trim(), decidedById: userId, decidedAt: new Date() },
    });
  }
}
