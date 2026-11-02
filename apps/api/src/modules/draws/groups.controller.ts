import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { GroupsService } from './groups.service';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

class CreateGroupsDto {
  @ApiProperty({ example: 4, description: 'Guruhlar soni' })
  @IsInt()
  @Min(1)
  @Max(32)
  groupCount!: number;

  @ApiProperty({ example: 2, description: 'Har guruhdan setkaga chiqadiganlar soni' })
  @IsInt()
  @Min(1)
  @Max(8)
  advancing!: number;

  @ApiPropertyOptional({ enum: [3, 5, 7], default: 5 })
  @IsOptional()
  @IsIn([3, 5, 7])
  bestOf?: number;

  @ApiPropertyOptional({ description: "O'zgartirilgan zmeyka (4.7.2.3)" })
  @IsOptional()
  @IsBoolean()
  modifiedSnake?: boolean;
}

@ApiTags('groups')
@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Public()
  @CacheFor(5)
  @Get('category/:categoryId')
  view(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.groups.view(categoryId);
  }

  @Post('category/:categoryId')
  @RequirePermissions('draw.manage')
  create(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: CreateGroupsDto,
  ) {
    return this.groups.create(categoryId, dto);
  }

  /** Qurani avtomatik o'tkazish: format va guruhlar sonini tizim o'zi tanlaydi */
  @Post('category/:categoryId/auto')
  @RequirePermissions('draw.manage')
  auto(@Param('categoryId', ParseUUIDPipe) categoryId: string) {
    return this.groups.auto(categoryId);
  }

  /** Guruhdan setkaga (play-off) o'tkazish. `?force=1` — tugamagan o'yinlar bilan ham */
  @Post('category/:categoryId/advance')
  @RequirePermissions('draw.manage')
  advance(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Query('force') force?: string,
  ) {
    return this.groups.advance(categoryId, { force: force === '1' || force === 'true' });
  }
}
