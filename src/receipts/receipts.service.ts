// src/receipts/receipts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Receipt, ReceiptDocument } from './schemas/receipt.schema';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { QueryReceiptsDto } from './dto/query-receipts.dto';

@Injectable()
export class ReceiptsService {
  constructor(
    @InjectModel(Receipt.name) private receiptModel: Model<ReceiptDocument>,
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
    return receipt.save();
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
    // ensures it exists & belongs to user
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

  // internal helper — used later by the OCR step, not exposed via controller
  async updateOcrResult(id: string, data: Partial<Receipt>) {
    return this.receiptModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}
