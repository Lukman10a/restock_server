// src/upload/upload.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { CloudinaryService } from './cloudinaryupload.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [CloudinaryService],
  exports: [CloudinaryService], // Receipts module will need this later
})
export class UploadModule {}
