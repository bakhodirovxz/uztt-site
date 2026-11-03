import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

/** Stollardagi jonli hisob. Elementlar servisda tekshiriladi (SbResultDto dagi sabab bilan) */
export class SbLiveDto {
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  @IsArray()
  @ArrayMaxSize(64)
  matches!: Array<{ siteId: string; court: string; points: [number, number]; setsWon: [number, number]; sets: Array<[number, number]> }>;
}

/**
 * Scoreboard'dan kelgan o'yin natijasi.
 *
 * Tuple ichidagi qiymatlar (butun son, 0–60) servisda tekshiriladi —
 * class-validator `[number, number]` juftlikni ifodalay olmaydi. Bu DTO
 * esa global ValidationPipe'dan o'tishni ta'minlaydi: ortiqcha maydonlar
 * rad etiladi va `sets` massiv bo'lmasa 500 emas, 400 qaytadi.
 */
export class SbResultDto {
  @ApiProperty({ description: "Saytdagi o'yin ID si" })
  // Match.id doim UUID (Prisma @default(uuid()) / draws: randomUUID())
  @IsUUID()
  siteId!: string;

  @ApiProperty({ type: 'array', items: { type: 'array', items: { type: 'integer' } }, example: [[11, 7], [9, 11]] })
  @IsArray()
  @ArrayMaxSize(7)
  sets!: Array<[number, number]>;
}
