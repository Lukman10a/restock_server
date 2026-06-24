// src/receipts/receipts.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Receipt, ReceiptDocument } from './schemas/receipt.schema';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { QueryReceiptsDto } from './dto/query-receipts.dto';
import { OcrService } from '../ocr/ocr.service';

@Injectable()
export class ReceiptsService {
  private readonly logger = new Logger(ReceiptsService.name);

  constructor(
    @InjectModel(Receipt.name)
    private receiptModel: Model<ReceiptDocument>,
    private readonly ocrService: OcrService,
  ) {}

  async create(
    dto: CreateReceiptDto,
    userId: string,
  ): Promise<ReceiptDocument> {
    const receipt = new this.receiptModel({
      ...dto,
      userId,
      status: 'pending',
    });

    const saved = await receipt.save();

    // Fire-and-forget OCR processing
    void this.processOcrAsync(saved._id.toString(), dto.imageUrl);

    return saved;
  }

  async findAllForUser(userId: string, query: QueryReceiptsDto) {
    const page = parseInt(query.page ?? '1', 10);
    const limit = parseInt(query.limit ?? '20', 10);
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { userId };

    if (query.status) {
      filter.status = query.status;
    }

    const [receipts, total] = await Promise.all([
      this.receiptModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.receiptModel.countDocuments(filter).exec(),
    ]);

    return {
      data: receipts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<ReceiptDocument> {
    const receipt = await this.receiptModel.findById(id).exec();

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    if (receipt.userId.toString() !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return receipt;
  }

  async update(
    id: string,
    dto: UpdateReceiptDto,
    userId: string,
  ): Promise<ReceiptDocument> {
    // Ensure ownership
    await this.findOne(id, userId);

    const updated = await this.receiptModel
      .findByIdAndUpdate(
        id,
        { ...dto, status: 'manually_edited' },
        { new: true },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException('Receipt not found after update');
    }

    return updated;
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    await this.findOne(id, userId);

    await this.receiptModel.findByIdAndDelete(id).exec();

    return { message: 'Receipt deleted successfully' };
  }

  async reprocess(id: string, userId: string): Promise<ReceiptDocument> {
    const receipt = await this.findOne(id, userId);

    await this.receiptModel.findByIdAndUpdate(id, { status: 'pending' }).exec();

    // Fire-and-forget OCR again
    void this.processOcrAsync(id, receipt.imageUrl);

    return this.findOne(id, userId);
  }

  // 🔒 Internal OCR processor (async background)
  private async processOcrAsync(
    receiptId: string,
    imageUrl: string,
  ): Promise<void> {
    try {
      const parsed = await this.ocrService.extractFromImageUrl(imageUrl);

      console.log('OCR PARSED:', JSON.stringify(parsed, null, 2));

      await this.receiptModel
        .findByIdAndUpdate(receiptId, {
          rawOcrText: parsed.rawOcrText,
          vendorName: parsed.vendorName,
          totalAmount: parsed.totalAmount,
          currency: parsed.currency,
          purchaseDate: parsed.purchaseDate,
          items: parsed.items,
          ocrConfidence: parsed.confidence,
          status: 'processed',
        })
        .exec();

      console.log('OCR PARSED:', JSON.stringify(parsed, null, 2));

      this.logger.log(`OCR processed successfully for receipt ${receiptId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`OCR failed for receipt ${receiptId}: ${message}`);

      await this.receiptModel
        .findByIdAndUpdate(receiptId, { status: 'failed' })
        .exec();
    }
  }

  // Internal helper (for OCR/manual updates)
  async updateOcrResult(id: string, data: Partial<Receipt>) {
    return this.receiptModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}
