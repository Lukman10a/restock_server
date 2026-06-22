// src/dashboard/dashboard.service.ts
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Receipt, ReceiptDocument } from '../receipts/schemas/receipt.schema';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

export interface OverallStatsResult {
  totalSpend: number;
  receiptCount: number;
  avgPerReceipt: number;
  totalItems: number;
}

interface MonthlyResult {
  _id: { month: number };
  totalSpend: number;
  receiptCount: number;
}

interface StatusResult {
  _id: string;
  count: number;
}

export interface CategoryResult {
  itemName: string;
  totalSpend: number;
  timesOrdered: number;
}

export interface TopVendorResult {
  vendorName: string;
  totalSpend: number;
  visitCount: number;
  avgSpend: number;
}

export interface MonthStats {
  month: number;
  monthName: string;
  totalSpend: number;
  receiptCount: number;
}
export class DashboardService {
  constructor(
    @InjectModel(Receipt.name)
    private receiptModel: Model<ReceiptDocument>,
  ) {}

  async getSummary(userId: string, query: DashboardQueryDto) {
    const dateFilter = this.buildDateFilter(query);

    const [
      overallStats,
      monthlyBreakdown,
      topVendors,
      spendingByCategory,
      recentReceipts,
      statusBreakdown,
    ] = await Promise.all([
      this.getOverallStats(userId, dateFilter),
      this.getMonthlyBreakdown(userId, query),
      this.getTopVendors(userId, dateFilter),
      this.getSpendingByCategory(userId, dateFilter),
      this.getRecentReceipts(userId),
      this.getStatusBreakdown(userId),
    ]);

    return {
      overview: overallStats,
      monthlyBreakdown,
      topVendors,
      spendingByCategory,
      recentReceipts,
      statusBreakdown,
    };
  }

  private async getOverallStats(
    userId: string,
    dateFilter: Record<string, unknown>,
  ) {
    const result = await this.receiptModel.aggregate<OverallStatsResult>([
      {
        $match: {
          userId,
          status: { $in: ['processed', 'manually_edited'] },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalSpend: { $sum: '$totalAmount' },
          receiptCount: { $sum: 1 },
          avgPerReceipt: { $avg: '$totalAmount' },
          totalItems: { $sum: { $size: '$items' } },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        totalSpend: 0,
        receiptCount: 0,
        avgPerReceipt: 0,
        totalItems: 0,
      };
    }

    const stats = result[0];
    return {
      totalSpend: Math.round(stats.totalSpend * 100) / 100,
      receiptCount: stats.receiptCount,
      avgPerReceipt: Math.round(stats.avgPerReceipt * 100) / 100,
      totalItems: stats.totalItems,
    };
  }

  private async getMonthlyBreakdown(userId: string, query: DashboardQueryDto) {
    const year = parseInt(query.year ?? new Date().getFullYear().toString());

    const result = await this.receiptModel.aggregate<MonthlyResult>([
      {
        $match: {
          userId,
          status: { $in: ['processed', 'manually_edited'] },
          purchaseDate: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          },
        },
      },
      {
        $group: {
          _id: { month: { $month: '$purchaseDate' } },
          totalSpend: { $sum: '$totalAmount' },
          receiptCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const found = result.find((r) => r._id.month === i + 1);
      return {
        month: i + 1,
        monthName: new Date(year, i, 1).toLocaleString('default', {
          month: 'short',
        }),
        totalSpend: found ? Math.round(found.totalSpend * 100) / 100 : 0,
        receiptCount: found ? found.receiptCount : 0,
      };
    });

    return { year, months };
  }

  private async getTopVendors(
    userId: string,
    dateFilter: Record<string, unknown>,
  ) {
    return this.receiptModel.aggregate<TopVendorResult>([
      {
        $match: {
          userId,
          status: { $in: ['processed', 'manually_edited'] },
          vendorName: { $exists: true, $ne: null },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: '$vendorName',
          totalSpend: { $sum: '$totalAmount' },
          visitCount: { $sum: 1 },
          avgSpend: { $avg: '$totalAmount' },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          vendorName: '$_id',
          totalSpend: { $round: ['$totalSpend', 2] },
          visitCount: 1,
          avgSpend: { $round: ['$avgSpend', 2] },
        },
      },
    ]);
  }

  private async getSpendingByCategory(
    userId: string,
    dateFilter: Record<string, unknown>,
  ) {
    return this.receiptModel.aggregate<CategoryResult>([
      {
        $match: {
          userId,
          status: { $in: ['processed', 'manually_edited'] },
          ...dateFilter,
        },
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.name',
          totalSpend: { $sum: '$items.totalPrice' },
          timesOrdered: { $sum: 1 },
        },
      },
      { $sort: { totalSpend: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          itemName: '$_id',
          totalSpend: { $round: ['$totalSpend', 2] },
          timesOrdered: 1,
        },
      },
    ]);
  }

  private async getRecentReceipts(userId: string) {
    return this.receiptModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select(
        'vendorName totalAmount currency status purchaseDate createdAt imageUrl',
      )
      .exec();
  }

  private async getStatusBreakdown(userId: string) {
    const result = await this.receiptModel.aggregate<StatusResult>([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown: Record<string, number> = {
      pending: 0,
      processed: 0,
      failed: 0,
      manually_edited: 0,
    };

    result.forEach((r) => {
      if (r._id in breakdown) {
        breakdown[r._id] = r.count;
      }
    });

    return breakdown;
  }

  private buildDateFilter(query: DashboardQueryDto): Record<string, unknown> {
    if (!query.year) return {};

    const year = parseInt(query.year);
    const month = query.month ? parseInt(query.month) : null;

    if (month) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      return { purchaseDate: { $gte: start, $lte: end } };
    }

    return {
      purchaseDate: {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31`),
      },
    };
  }

  async debugCount(userId: string) {
    const totalDocs = await this.receiptModel.countDocuments({}).exec();
    const withStringId = await this.receiptModel
      .countDocuments({ userId })
      .exec();
    return {
      totalDocsInCollection: totalDocs,
      matchingWithStringUserId: withStringId,
    };
  }
}
