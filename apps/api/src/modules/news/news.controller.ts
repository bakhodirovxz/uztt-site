import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto, UpdateNewsDto } from './dto/news.dto';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Revalidates } from '../../common/revalidate/revalidate.decorator';
import { CacheFor } from '../../common/interceptors/cache-control.interceptor';

@ApiTags('news')
@Revalidates('news')
@Controller('news')
export class NewsController {
  constructor(private readonly news: NewsService) {}

  @Public()
  @CacheFor(60)
  @Get()
  list(
    @Query('locale') locale?: string,
    @Query('tournamentId') tournamentId?: string,
  ) {
    return this.news.list(locale, tournamentId);
  }

  @Get('admin/all')
  @RequirePermissions('news.manage')
  adminList() {
    return this.news.adminList();
  }

  @Public()
  @CacheFor(60)
  @Get(':slug')
  bySlug(@Param('slug') slug: string, @Query('locale') locale?: string) {
    return this.news.bySlug(slug, locale);
  }

  @Post()
  @RequirePermissions('news.manage')
  create(@Body() dto: CreateNewsDto) {
    return this.news.create(dto);
  }

  @Put(':id')
  @RequirePermissions('news.manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateNewsDto) {
    return this.news.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('news.manage')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.news.remove(id);
  }
}
