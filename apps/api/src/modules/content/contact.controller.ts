import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ContactStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

class ContactDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(3000) body!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn(['uz', 'ru', 'en'])
  locale?: string;

  /** Honeypot — odam to'ldirmaydi; bot to'ldirsa so'rov rad etiladi */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;
}

class StatusDto {
  @ApiProperty({ enum: ContactStatus })
  @IsIn(Object.values(ContactStatus))
  status!: ContactStatus;
}

@ApiTags('contact')
@Controller('contact')
export class ContactController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Post()
  @Throttle({ default: { limit: 3, ttl: 3600_000 } }) // 3 / soat / IP
  async submit(@Body() dto: ContactDto, @Req() req: Request) {
    if (dto.website) {
      // Honeypot to'ldirilgan — bot. Jimgina muvaffaqiyat qaytaramiz.
      return { ok: true };
    }
    await this.prisma.contactMessage.create({
      data: {
        name: dto.name,
        email: dto.email,
        subject: dto.subject,
        body: dto.body,
        locale: dto.locale ?? 'uz',
        ip: req.ip,
      },
    });
    return { ok: true };
  }

  @Get('inbox')
  @RequirePermissions('contact.inbox')
  inbox(@Query('status') status?: ContactStatus) {
    return this.prisma.contactMessage.findMany({
      where: {
        status:
          status && Object.values(ContactStatus).includes(status)
            ? status
            : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post(':id/status')
  @RequirePermissions('contact.inbox')
  async setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StatusDto,
  ) {
    const exists = await this.prisma.contactMessage.findUnique({
      where: { id },
    });
    if (!exists) throw new BadRequestException('Murojaat topilmadi');
    return this.prisma.contactMessage.update({
      where: { id },
      data: { status: dto.status },
    });
  }
}
