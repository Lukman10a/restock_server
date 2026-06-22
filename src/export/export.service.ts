// src/export/export.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Parser } from 'json2csv';
import { Receipt, ReceiptDocument } from '../receipts/schemas/receipt.schema';
import { ExportReceiptsDto } from './dto/export-receipts.dto';

interface ReceiptRow {
  receipt_id: string;
  date: string;
  vendor: string;
  item_name: string;
  quantity: number | string;
  unit_price: number | string;
  item_total: number | string;
  receipt_total: number | string;
  currency: string;
  status: string;
  scanned_on: string;
}

@Injectable()
export class ExportService {
  constructor(
    @InjectModel(Receipt.name)
    private receiptModel: Model<ReceiptDocument>,
  ) {}

  async exportToCsv(
    userId: string,
    dto: ExportReceiptsDto,
  ): Promise<{ csv: string; filename: string }> {
    const filter: Record<string, unknown> = { userId };

    if (dto.status) {
      filter.status = dto.status;
    }

    if (dto.startDate ?? dto.endDate) {
      const dateRange: Record<string, Date> = {};
      if (dto.startDate) dateRange.$gte = new Date(dto.startDate);
      if (dto.endDate) dateRange.$lte = new Date(dto.endDate);
      filter.purchaseDate = dateRange;
    }

    const receipts = await this.receiptModel
      .find(filter)
      .sort({ purchaseDate: -1 })
      .exec();

    if (receipts.length === 0) {
      throw new NotFoundException(
        'No receipts found matching the selected filters',
      );
    }

    // flatten receipts into rows — one row per line item
    // if a receipt has no items, still produce one summary row
    const rows: ReceiptRow[] = [];

    receipts.forEach((receipt) => {
      if (receipt.items && receipt.items.length > 0) {
        receipt.items.forEach((item) => {
          rows.push({
            receipt_id: receipt._id.toString(),
            date: receipt.purchaseDate
              ? receipt.purchaseDate.toISOString().split('T')[0]
              : '',
            vendor: receipt.vendorName ?? '',
            item_name: item.name,
            quantity: item.quantity ?? '',
            unit_price: item.unitPrice ?? '',
            item_total: item.totalPrice ?? '',
            receipt_total: receipt.totalAmount ?? '',
            currency: receipt.currency ?? '',
            status: receipt.status,
            scanned_on: receipt.createdAt
              ? (receipt as ReceiptDocument & { createdAt: Date }).createdAt
                  .toISOString()
                  .split('T')[0]
              : '',
          });
        });
      } else {
        // receipt has no line items — produce a single summary row
        rows.push({
          receipt_id: receipt._id.toString(),
          date: receipt.purchaseDate
            ? receipt.purchaseDate.toISOString().split('T')[0]
            : '',
          vendor: receipt.vendorName ?? '',
          item_name: '',
          quantity: '',
          unit_price: '',
          item_total: '',
          receipt_total: receipt.totalAmount ?? '',
          currency: receipt.currency ?? '',
          status: receipt.status,
          scanned_on: receipt.createdAt
            ? (receipt as ReceiptDocument & { createdAt: Date }).createdAt
                .toISOString()
                .split('T')[0]
            : '',
        });
      }
    });

    const fields = [
      { label: 'Receipt ID', value: 'receipt_id' },
      { label: 'Date', value: 'date' },
      { label: 'Vendor', value: 'vendor' },
      { label: 'Item Name', value: 'item_name' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Unit Price', value: 'unit_price' },
      { label: 'Item Total', value: 'item_total' },
      { label: 'Receipt Total', value: 'receipt_total' },
      { label: 'Currency', value: 'currency' },
      { label: 'Status', value: 'status' },
      { label: 'Scanned On', value: 'scanned_on' },
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    // generate a meaningful filename
    const today = new Date().toISOString().split('T')[0];
    const filename = `restock-receipts-${today}.csv`;

    return { csv, filename };
  }
}
