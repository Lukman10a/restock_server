// src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import {
  CategoryResult,
  TopVendorResult,
  OverallStatsResult,
  MonthStats,
} from './dashboard.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

interface DashboardResponse {
  overview: OverallStatsResult;
  monthlyBreakdown: {
    year: number;
    months: MonthStats[];
  };
  topVendors: TopVendorResult[];
  spendingByCategory: CategoryResult[];
  recentReceipts: {
    vendorName: string;
    totalAmount: number;
    currency: string;
    status: string;
    purchaseDate: Date;
    createdAt: Date;
    imageUrl: string;
  }[];
  statusBreakdown: Record<string, number>;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  getSummary(
    @Query() query: DashboardQueryDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DashboardResponse> {
    return this.dashboardService.getSummary(req.user.userId, query);
  }

  @Get('debug')
  getDebug(@Req() req: AuthenticatedRequest) {
    return {
      userIdFromToken: req.user.userId,
      userIdType: typeof req.user.userId,
    };
  }

  @Get('raw-count')
  getRawCount(@Req() req: AuthenticatedRequest) {
    return this.dashboardService.debugCount(req.user.userId);
  }
}
