// src/export/export.controller.ts
import { Controller, Get, Query, UseGuards, Req, Res } from '@nestjs/common';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExportService } from './export.service';
import { ExportReceiptsDto } from './dto/export-receipts.dto';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
  };
}

@Controller('export')
@UseGuards(JwtAuthGuard)
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('receipts/csv')
  async exportCsv(
    @Query() dto: ExportReceiptsDto,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const { csv, filename } = await this.exportService.exportToCsv(
      req.user.userId,
      dto,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csv);
  }
}
