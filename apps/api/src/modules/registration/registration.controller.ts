import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, PlayerDocumentType } from '@prisma/client';
import { RegistrationService } from './registration.service';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';

class SignupDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(128) password!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) firstName!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) lastName!: string;
  @ApiProperty({ enum: Gender }) @IsEnum(Gender) gender!: Gender;
  @ApiProperty({ example: '2014-05-20' }) @IsISO8601() birthDate!: string;
  @ApiProperty() @IsString() @MaxLength(60) region!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) club?: string;

  @ApiPropertyOptional({
    description:
      "Ishtirok etmoqchi bo'lgan yosh toifalari (U13, U15, SENIOR...)",
    example: ['U15', 'SENIOR'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  ageCategoryCodes?: string[];
}

class RegisterDto {
  @ApiPropertyOptional({ description: 'Berilmasa — o‘z yosh guruhi (default)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Juftlik/aralash juftlik uchun sherik' })
  @IsOptional()
  @IsUUID()
  partnerPlayerId?: string;

  @ApiPropertyOptional({ description: 'Jamoaviy guruh uchun jamoa nomi' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  teamName?: string;
}

class AgeCategoriesDto {
  @ApiProperty({ example: ['U15', 'SENIOR'] })
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(12, { each: true })
  codes!: string[];
}

class AddParticipantDto {
  @ApiProperty() @IsUUID() playerId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerPlayerId?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  teamName?: string;
}

class UploadDocDto {
  @ApiProperty({ enum: PlayerDocumentType })
  @IsEnum(PlayerDocumentType)
  type!: PlayerDocumentType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  documentNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() expiryDate?: string;
}

@ApiTags('registration')
@Controller('registration')
export class RegistrationController {
  constructor(private readonly reg: RegistrationService) {}

  @Public()
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 3600_000 } }) // 5 / soat / IP
  signup(@Body() dto: SignupDto) {
    return this.reg.signup(dto);
  }

  @Get('me')
  myPlayer(@CurrentUser() user: AuthUser) {
    return this.reg.myPlayer(user.id);
  }

  @Get('tournaments/:id/eligible-categories')
  eligible(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.reg.eligibleCategoriesFor(user.id, tournamentId);
  }

  @Post('tournaments/:id/register')
  register(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Body() dto: RegisterDto,
  ) {
    return this.reg.register(user.id, tournamentId, dto.categoryId, {
      partnerPlayerId: dto.partnerPlayerId,
      teamName: dto.teamName,
    });
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  uploadDocument(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadDocDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.reg.uploadDocument(user.id, {
      ...dto,
      file: file ? { buffer: file.buffer, mimetype: file.mimetype } : undefined,
    });
  }

  // ==================== ADMIN ====================

  @Get('pending')
  @RequirePermissions('player.verify')
  pending() {
    return this.reg.pendingPlayers();
  }

  @Post('players/:id/verify')
  @RequirePermissions('player.verify')
  verify(@Param('id', ParseUUIDPipe) id: string) {
    return this.reg.verifyPlayer(id);
  }

  /** Admin/operator: o'yinchining yosh toifalarini tuzatish */
  @Post('players/:id/age-categories')
  @RequirePermissions('player.verify')
  setAgeCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AgeCategoriesDto,
  ) {
    return this.reg.setDeclaredCategories(id, dto.codes);
  }

  /** Operator: kategoriyaga qatnashchi qo'shish */
  @Post('categories/:id/participants')
  @RequirePermissions('registration.manage')
  addParticipant(
    @Param('id', ParseUUIDPipe) categoryId: string,
    @Body() dto: AddParticipantDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reg.addParticipant(categoryId, dto.playerId, user.id, {
      partnerPlayerId: dto.partnerPlayerId,
      teamName: dto.teamName,
    });
  }

  /** Maxfiy hujjatni ko'rish — faqat player.document.view, har ochilish loglanadi */
  @Get('documents/:id')
  @RequirePermissions('player.document.view')
  async viewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const doc = await this.reg.viewDocument(id, user.id, req.ip);
    if (doc.fileBuffer) {
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="document-${doc.id}.bin"`,
      );
      res.send(doc.fileBuffer);
      return;
    }
    res.json({
      id: doc.id,
      type: doc.type,
      player: doc.player,
      documentNumber: doc.documentNumber,
      expiryDate: doc.expiryDate,
    });
  }
}
