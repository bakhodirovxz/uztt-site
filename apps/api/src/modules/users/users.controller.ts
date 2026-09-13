import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class CreateUserDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) lastName!: string;

  @ApiPropertyOptional({ example: ['OPERATOR'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  roleCodes?: string[];
}

class UpdateUserDto {
  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;
}

class ResetPasswordDto {
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
}

/**
 * Foydalanuvchilar boshqaruvi — root (SUPERADMIN) uchun.
 * Rollarni biriktirish `roles` modulida (role.manage).
 */
@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('user.manage')
  async list(@Query('query') query?: string) {
    const users = await this.prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: 'insensitive' } },
              { lastName: { contains: query, mode: 'insensitive' } },
              { firstName: { contains: query, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
        roles: { select: { role: { select: { code: true, name: true } } } },
      },
    });
    return users.map((u) => ({
      ...u,
      roles: u.roles.map((r) => r.role.code),
      roleNames: u.roles.map((r) => r.role.name),
    }));
  }

  @Post()
  @RequirePermissions('user.manage')
  async create(@Body() dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new ConflictException('Bu email allaqachon band');

    const roles = dto.roleCodes?.length
      ? await this.prisma.role.findMany({
          where: { code: { in: dto.roleCodes } },
        })
      : [];
    if (dto.roleCodes?.length && roles.length !== dto.roleCodes.length) {
      throw new BadRequestException('Nomaʼlum rol kodi');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(dto.password, {
          type: argon2.argon2id,
        }),
        firstName: dto.firstName,
        lastName: dto.lastName,
        roles: { create: roles.map((r) => ({ roleId: r.id })) },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return { ...user, roles: roles.map((r) => r.code) };
  }

  @Patch(':id')
  @RequirePermissions('user.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthUser,
  ) {
    if (id === actor.id && dto.status && dto.status !== 'ACTIVE') {
      throw new ForbiddenException("O'zingizni bloklab bo'lmaydi");
    }
    await this.assertNotLastRoot(id, dto.status);
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        status: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  @Post(':id/password')
  @RequirePermissions('user.manage')
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Foydalanuvchi topilmadi');
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(dto.password, {
          type: argon2.argon2id,
        }),
      },
    });
    // Barcha sessiyalar bekor qilinadi — parol o'zgargach qayta kirish shart
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  @Delete(':id')
  @RequirePermissions('user.manage')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ) {
    if (id === actor.id) {
      throw new ForbiddenException("O'zingizni o'chirib bo'lmaydi");
    }
    await this.assertNotLastRoot(id, 'BLOCKED');
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  /** Oxirgi root hisobini bloklash/o'chirishdan himoya */
  private async assertNotLastRoot(userId: string, nextStatus?: UserStatus) {
    if (!nextStatus || nextStatus === 'ACTIVE') return;
    const isRoot = await this.prisma.userRole.findFirst({
      where: { userId, role: { code: 'SUPERADMIN' } },
    });
    if (!isRoot) return;
    const activeRoots = await this.prisma.user.count({
      where: {
        status: 'ACTIVE',
        roles: { some: { role: { code: 'SUPERADMIN' } } },
      },
    });
    if (activeRoots <= 1) {
      throw new ForbiddenException(
        'Tizimda kamida bitta faol root hisobi qolishi kerak',
      );
    }
  }
}
