import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  defaultCategory,
  eligibleCategories,
} from '../registration/eligibility';

@Injectable()
export class CoachService {
  constructor(private readonly prisma: PrismaService) {}

  /** Murabbiy profili — birinchi murojaatda avtomatik yaratiladi */
  async myProfile(userId: string) {
    let profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
      include: { players: true },
    });
    if (!profile) {
      profile = await this.prisma.coachProfile.create({
        data: { userId },
        include: { players: true },
      });
    }

    const playerIds = profile.players.map((p) => p.playerId);
    const players = playerIds.length
      ? await this.prisma.player.findMany({
          where: { id: { in: playerIds } },
          select: {
            id: true,
            slug: true,
            firstName: true,
            lastName: true,
            gender: true,
            birthDate: true,
            region: true,
            club: true,
            rankingPoints: true,
            status: true,
            licenseNumber: true,
          },
          orderBy: { rankingPoints: 'desc' },
        })
      : [];

    return {
      id: profile.id,
      club: profile.club,
      licenseNumber: profile.licenseNumber,
      bio: profile.bio,
      players,
    };
  }

  async updateProfile(
    userId: string,
    data: { club?: string; licenseNumber?: string; bio?: string },
  ) {
    await this.myProfile(userId); // mavjudligini kafolatlaymiz
    return this.prisma.coachProfile.update({
      where: { userId },
      data,
      select: { id: true, club: true, licenseNumber: true, bio: true },
    });
  }

  /** O'quvchini litsenziya raqami bo'yicha qo'shish */
  async addPlayer(userId: string, licenseNumber: string) {
    const profile = await this.ensureProfile(userId);
    const player = await this.prisma.player.findUnique({
      where: { licenseNumber: licenseNumber.trim().toUpperCase() },
    });
    if (!player) {
      throw new NotFoundException(
        'Bunday litsenziya raqamli o‘yinchi topilmadi',
      );
    }
    const exists = await this.prisma.coachPlayer.findUnique({
      where: {
        coachId_playerId: { coachId: profile.id, playerId: player.id },
      },
    });
    if (exists)
      throw new ConflictException('Bu o‘yinchi allaqachon ro‘yxatingizda');

    await this.prisma.coachPlayer.create({
      data: { coachId: profile.id, playerId: player.id },
    });
    return { ok: true, playerId: player.id };
  }

  async removePlayer(userId: string, playerId: string) {
    const profile = await this.ensureProfile(userId);
    await this.prisma.coachPlayer.deleteMany({
      where: { coachId: profile.id, playerId },
    });
    return { ok: true };
  }

  /** O'z o'quvchisi uchun muvofiq kategoriyalar (yosh qoidasi bir xil) */
  async eligibleFor(userId: string, playerId: string, tournamentId: string) {
    await this.assertOwnPlayer(userId, playerId);

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player?.birthDate) {
      throw new BadRequestException(
        "O'yinchining tug'ilgan sanasi kiritilmagan",
      );
    }
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { categories: { include: { ageCategory: true } } },
    });
    if (!tournament) throw new NotFoundException('Musobaqa topilmadi');

    const catLikes = tournament.categories
      .filter((c) => c.gender === player.gender)
      .map((c) => ({
        id: c.id,
        code: c.ageCategory.code,
        maxAge: c.ageCategory.maxAge,
        sortOrder: c.ageCategory.sortOrder,
      }));
    const year = tournament.startDate.getFullYear();
    const eligible = eligibleCategories(player.birthDate, year, catLikes);
    const def = defaultCategory(player.birthDate, year, catLikes);
    return {
      eligible: eligible.map((c) => ({ ...c, isDefault: c.id === def?.id })),
    };
  }

  /** O'z o'quvchisini turnirga yozish (source: COACH) */
  async registerPlayer(
    userId: string,
    playerId: string,
    tournamentId: string,
    categoryId?: string,
  ) {
    await this.assertOwnPlayer(userId, playerId);
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (player?.status !== 'ACTIVE') {
      throw new ForbiddenException("O'yinchi profili hali tasdiqlanmagan");
    }

    const { eligible } = await this.eligibleFor(userId, playerId, tournamentId);
    const target = categoryId
      ? eligible.find((c) => c.id === categoryId)
      : eligible.find((c) => c.isDefault);
    if (!target) {
      throw new ForbiddenException(
        "Bu kategoriya o'yinchining yoshiga muvofiq emas",
      );
    }

    const exists = await this.prisma.tournamentRegistration.findUnique({
      where: {
        playerId_tournamentCategoryId: {
          playerId,
          tournamentCategoryId: target.id,
        },
      },
    });
    if (exists) throw new ConflictException('Allaqachon yozilgan');

    return this.prisma.tournamentRegistration.create({
      data: {
        playerId,
        tournamentCategoryId: target.id,
        source: 'COACH',
      },
      include: {
        category: { include: { ageCategory: { select: { code: true } } } },
      },
    });
  }

  // ==================== ichki ====================

  private async ensureProfile(userId: string) {
    let profile = await this.prisma.coachProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      profile = await this.prisma.coachProfile.create({ data: { userId } });
    }
    return profile;
  }

  private async assertOwnPlayer(userId: string, playerId: string) {
    const profile = await this.ensureProfile(userId);
    const link = await this.prisma.coachPlayer.findUnique({
      where: { coachId_playerId: { coachId: profile.id, playerId } },
    });
    if (!link) {
      throw new ForbiddenException("Bu o'yinchi sizning ro'yxatingizda emas");
    }
  }
}
