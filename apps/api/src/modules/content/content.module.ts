import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { VideosController } from './videos.controller';
import { GalleriesController } from './galleries.controller';
import { FederationController } from './federation.controller';
import { ContactController } from './contact.controller';
import { SearchController } from './search.controller';
import { PagesController } from './pages.controller';

@Module({
  controllers: [
    UploadsController,
    VideosController,
    GalleriesController,
    FederationController,
    ContactController,
    SearchController,
    PagesController,
  ],
})
export class ContentModule {}
