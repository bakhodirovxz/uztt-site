import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

class CreateRoleDto {
  @ApiProperty({ example: 'MEDIA_MANAGER' })
  @Matches(/^[A-Z][A-Z0-9_]{2,30}$/, {
    message: 'Kod KATTA_HARF_VA_PASTKI_CHIZIQ formatida bo‘lsin',
  })
  code!: string;

  @ApiProperty() @IsString() @MinLength(3) @MaxLength(60) name!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions?: string[];
}

class SetPermissionsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissions!: string[];
}

class AssignRoleDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() roleCode!: string;
}

/**
 * Rollar boshqaruvi: yangi rol qo'shish = ma'lumot, kod emas.
 * Permissionlar access tokenda ketadi — rol o'zgarishi keyingi
 * refresh'da (maks. 15 daqiqa) kuchga kiradi.
 */
@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('role.manage')
  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    return roles.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.code),
    }));
  }

  @Get('permissions')
  @RequirePermissions('role.manage')
  permissions() {
    return this.prisma.permission.findMany({ orderBy: { code: 'asc' } });
  }

  @Post()
  @RequirePermissions('role.manage')
  async create(@Body() dto: CreateRoleDto) {
    const exists = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });
    if (exists) throw new BadRequestException('Bu kod band');

    const maxSort = await this.prisma.role.aggregate({
      _max: { sortOrder: true },
    });
    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });
    if (dto.permissions?.length) {
      await this.setPermissionList(role.id, dto.permissions);
    }
    return role;
  }

  @Put(':id/permissions')
  @RequirePermissions('role.manage')
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionsDto,
  ) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol topilmadi');
    if (role.code === 'SUPERADMIN') {
      throw new BadRequestException(
        'SUPERADMIN permissionlari o‘zgartirilmaydi',
      );
    }
    await this.setPermissionList(id, dto.permissions);
    return { ok: true };
  }

  @Delete(':id')
  @RequirePermissions('role.manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Rol topilmadi');
    if (role.isSystem) {
      throw new BadRequestException('Tizim rollari o‘chirilmaydi');
    }
    await this.prisma.role.delete({ where: { id } });
    return { ok: true };
  }

  @Post('assign')
  @RequirePermissions('role.manage')
  async assign(@Body() dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (!user) throw new NotFoundException('Bunday email topilmadi');
    const role = await this.prisma.role.findUnique({
      where: { code: dto.roleCode },
    });
    if (!role) throw new NotFoundException('Rol topilmadi');

    await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
    return { ok: true };
  }

  @Post('unassign')
  @RequirePermissions('role.manage')
  async unassign(@Body() dto: AssignRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    const role = await this.prisma.role.findUnique({
      where: { code: dto.roleCode },
    });
    if (!user || !role) throw new NotFoundException('Topilmadi');
    await this.prisma.userRole.deleteMany({
      where: { userId: user.id, roleId: role.id },
    });
    return { ok: true };
  }

  private async setPermissionList(roleId: string, codes: string[]) {
    const perms = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
    });
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });
    if (perms.length) {
      await this.prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId, permissionId: p.id })),
      });
    }
  }
}
