// src/export/export.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Receipt, ReceiptSchema } from '../receipts/schemas/receipt.schema';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Receipt.name, schema: ReceiptSchema }]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
