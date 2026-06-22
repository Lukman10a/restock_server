// src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Receipt, ReceiptSchema } from '../receipts/schemas/receipt.schema';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Receipt.name, schema: ReceiptSchema }]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
