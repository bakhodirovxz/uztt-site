import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { StaffType, DocumentCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { pickTranslation } from './locale.util';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';

// ==================== DTO ====================

class StaffTrDto {
  @ApiProperty({ enum: ['uz', 'ru', 'en'] })
  @IsIn(['uz', 'ru', 'en'])
  locale!: string;

  @ApiProperty() @IsString() @MaxLength(150) fullName!: string;
  @ApiProperty() @IsString() @MaxLength(150) position!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;
}

class CreateStaffDto {
  @ApiProperty({ enum: StaffType }) @IsEnum(StaffType) type!: StaffType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @ApiProperty({ type: [StaffTrDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StaffTrDto)
  translations!: StaffTrDto[];
}

class UpdateStaffDto {
  @ApiPropertyOptional({ enum: StaffType })
  @IsOptional()
  @IsEnum(StaffType)
  type?: StaffType;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @ApiPropertyOptional({ type: [StaffTrDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffTrDto)
  translations?: StaffTrDto[];
}

class DocTrDto {
  @ApiProperty({ enum: ['uz', 'ru', 'en'] })
  @IsIn(['uz', 'ru', 'en'])
  locale!: string;

  @ApiProperty() @IsString() @MaxLength(300) title!: string;
}

class CreateDocDto {
  @ApiProperty({ enum: DocumentCategory })
  @IsEnum(DocumentCategory)
  category!: DocumentCategory;
  @ApiProperty() @IsString() @MaxLength(500) fileUrl!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) fileSize?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiProperty({ type: [DocTrDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DocTrDto)
  translations!: DocTrDto[];
}

class UpdateDocDto {
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  fileUrl?: string;

  @ApiPropertyOptional({ type: [DocTrDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocTrDto)
  translations?: DocTrDto[];
}

class SponsorDto {
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  @MaxLength(500)
  websiteUrl?: string;
  @ApiPropertyOptional({ description: '1 = bosh homiy' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  tier?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

/** Federatsiya sahifasi ma'lumotlari: rahbariyat, xodimlar, hujjatlar, homiylar */
@ApiTags('federation')
@Revalidates('federation')
@Controller('federation')
export class FederationController {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== XODIMLAR ====================

  @Public()
  @CacheFor(300)
  @Get('staff')
  async staff(
    @Query('type') type?: StaffType,
    @Query('locale') locale?: string,
  ) {
    const rows = await this.prisma.staffProfile.findMany({
      where: {
        type:
          type && Object.values(StaffType).includes(type) ? type : undefined,
      },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      include: { translations: true },
    });
    return rows.map((s) => {
      const tr = pickTranslation(s.translations, locale);
      return {
        id: s.id,
        type: s.type,
        photoUrl: s.photoUrl,
        email: s.email,
        phone: s.phone,
        fullName: tr?.fullName ?? '',
        position: tr?.position ?? '',
        bio: tr?.bio ?? null,
      };
    });
  }

  /** Admin ro'yxati — barcha tarjimalar bilan (tahrirlash formasi uchun) */
  @Get('admin/staff')
  @RequirePermissions('page.manage')
  adminStaff() {
    return this.prisma.staffProfile.findMany({
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
      include: { translations: true },
    });
  }

  @Post('staff')
  @RequirePermissions('page.manage')
  createStaff(@Body() dto: CreateStaffDto) {
    return this.prisma.staffProfile.create({
      data: {
        type: dto.type,
        photoUrl: dto.photoUrl,
        email: dto.email,
        phone: dto.phone,
        sortOrder: dto.sortOrder ?? 0,
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
  }

  @Put('staff/:id')
  @RequirePermissions('page.manage')
  async updateStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
  ) {
    const exists = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Xodim topilmadi');

    for (const t of dto.translations ?? []) {
      await this.prisma.staffTranslation.upsert({
        where: { staffId_locale: { staffId: id, locale: t.locale } },
        update: { fullName: t.fullName, position: t.position, bio: t.bio },
        create: { staffId: id, ...t },
      });
    }

    return this.prisma.staffProfile.update({
      where: { id },
      data: {
        type: dto.type,
        photoUrl: dto.photoUrl,
        email: dto.email,
        phone: dto.phone,
        sortOrder: dto.sortOrder,
      },
      include: { translations: true },
    });
  }

  @Delete('staff/:id')
  @RequirePermissions('page.manage')
  async removeStaff(@Param('id', ParseUUIDPipe) id: string) {
    const exists = await this.prisma.staffProfile.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Xodim topilmadi');
    await this.prisma.staffProfile.delete({ where: { id } });
    return { ok: true };
  }

  // ==================== HUJJATLAR ====================

  @Public()
  @CacheFor(300)
  @Get('documents')
  async documents(
    @Query('category') category?: DocumentCategory,
    @Query('locale') locale?: string,
  ) {
    const rows = await this.prisma.federationDocument.findMany({
      where: {
        category:
          category && Object.values(DocumentCategory).includes(category)
            ? category
            : undefined,
      },
      orderBy: { publishedAt: 'desc' },
      include: { translations: true },
    });
    return rows.map((d) => ({
      id: d.id,
      category: d.category,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      publishedAt: d.publishedAt,
      title: pickTranslation(d.translations, locale)?.title ?? '',
    }));
  }

  @Get('admin/documents')
  @RequirePermissions('page.manage')
  adminDocuments() {
    return this.prisma.federationDocument.findMany({
      orderBy: { publishedAt: 'desc' },
      include: { translations: true },
    });
  }

  @Post('documents')
  @RequirePermissions('page.manage')
  createDocument(@Body() dto: CreateDocDto) {
    return this.prisma.federationDocument.create({
      data: {
        category: dto.category,
        fileUrl: dto.fileUrl,
        fileSize: dto.fileSize,
        mimeType: dto.mimeType,
        translations: { create: dto.translations },
      },
      include: { translations: true },
    });
  }

  @Put('documents/:id')
  @RequirePermissions('page.manage')
  async updateDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocDto,
  ) {
    const exists = await this.prisma.federationDocument.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Hujjat topilmadi');

    for (const t of dto.translations ?? []) {
      await this.prisma.federationDocumentTranslation.upsert({
        where: { documentId_locale: { documentId: id, locale: t.locale } },
        update: { title: t.title },
        create: { documentId: id, locale: t.locale, title: t.title },
      });
    }

    return this.prisma.federationDocument.update({
      where: { id },
      data: { category: dto.category, fileUrl: dto.fileUrl },
      include: { translations: true },
    });
  }

  @Delete('documents/:id')
  @RequirePermissions('page.manage')
  async removeDocument(@Param('id', ParseUUIDPipe) id: string) {
    const exists = await this.prisma.federationDocument.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Hujjat topilmadi');
    await this.prisma.federationDocument.delete({ where: { id } });
    return { ok: true };
  }

  // ==================== HOMIYLAR ====================

  @Public()
  @CacheFor(300)
  @Get('sponsors')
  sponsors() {
    return this.prisma.sponsor.findMany({
      orderBy: [{ tier: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  @Post('sponsors')
  @RequirePermissions('page.manage')
  createSponsor(@Body() dto: SponsorDto) {
    return this.prisma.sponsor.create({
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        websiteUrl: dto.websiteUrl,
        tier: dto.tier ?? 1,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  @Put('sponsors/:id')
  @RequirePermissions('page.manage')
  async updateSponsor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SponsorDto,
  ) {
    const exists = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Homiy topilmadi');
    return this.prisma.sponsor.update({ where: { id }, data: { ...dto } });
  }

  @Delete('sponsors/:id')
  @RequirePermissions('page.manage')
  async removeSponsor(@Param('id', ParseUUIDPipe) id: string) {
    const exists = await this.prisma.sponsor.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Homiy topilmadi');
    await this.prisma.sponsor.delete({ where: { id } });
    return { ok: true };
  }
}
