import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { StreamChannelType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class AssignChannelDto {
  @ApiProperty({ example: 'overlay1@uztt.uz' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: StreamChannelType })
  @IsIn(Object.values(StreamChannelType))
  type!: StreamChannelType;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(64)
  tableNumber!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  label?: string;
}

/**
 * Translatsiya kanallari: OVERLAY (OBS scorebug) va SCREEN (zal monitori).
 * Har kanal bitta stolga biriktiriladi — o'yin almashsa ham URL o'zgarmaydi.
 */
@ApiTags('stream')
@Controller('stream')
export class StreamController {
  constructor(private readonly prisma: PrismaService) {}

  /** Operator o'z kanalini va URL'larini ko'radi */
  @Get('me')
  @RequirePermissions('stream.view')
  async me(@CurrentUser() user: AuthUser) {
    const profile = await this.prisma.streamProfile.findUnique({
      where: { userId: user.id },
    });
    if (!profile) {
      throw new NotFoundException(
        'Sizga stol biriktirilmagan — administratorga murojaat qiling',
      );
    }
    return {
      type: profile.type,
      tableNumber: profile.tableNumber,
      label: profile.label,
      overlayPath: `/overlay/table/${profile.tableNumber}`,
      screenPath: `/screen/${profile.tableNumber}`,
    };
  }

  /** Barcha kanallar ro'yxati — operator translatsiya havolalarini shu yerdan oladi */
  @Get('channels')
  @RequirePermissions('stream.view')
  async channels() {
    const rows = await this.prisma.streamProfile.findMany({
      orderBy: [{ type: 'asc' }, { tableNumber: 'asc' }],
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: rows.map((r) => r.userId) } },
      select: { id: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u.email]));
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      tableNumber: r.tableNumber,
      label: r.label,
      email: byId.get(r.userId) ?? null,
      path:
        r.type === 'OVERLAY'
          ? `/overlay/table/${r.tableNumber}`
          : `/screen/${r.tableNumber}`,
    }));
  }

  @Post('channels')
  @RequirePermissions('user.manage')
  async assign(@Body() dto: AssignChannelDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user) throw new NotFoundException('Bunday email topilmadi');

    // Kanal roli ham avtomatik biriktiriladi
    const roleCode = dto.type === 'OVERLAY' ? 'STREAM' : 'SCREEN';
    const role = await this.prisma.role.findUnique({
      where: { code: roleCode },
    });
    if (role) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    return this.prisma.streamProfile.upsert({
      where: { userId: user.id },
      update: {
        type: dto.type,
        tableNumber: dto.tableNumber,
        label: dto.label,
      },
      create: {
        userId: user.id,
        type: dto.type,
        tableNumber: dto.tableNumber,
        label: dto.label,
      },
    });
  }

  @Delete('channels/:id')
  @RequirePermissions('user.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.streamProfile.delete({ where: { id } });
    return { ok: true };
  }
}
