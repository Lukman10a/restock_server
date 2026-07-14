// src/receipts/receipts.controller.ts
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReceiptsService } from './receipts.service';
import { CreateReceiptDto } from './dto/create-receipt.dto';
import { UpdateReceiptDto } from './dto/update-receipt.dto';
import { QueryReceiptsDto } from './dto/query-receipts.dto';
import type { RequestWithUser } from '../types/request-with-user';
import { Throttle } from '@nestjs/throttler';

@Controller('receipts')
@UseGuards(JwtAuthGuard)
export class ReceiptsController {
  constructor(private receiptsService: ReceiptsService) {}

  // OCR is expensive, max 10 scans per minute per user
  @Post()
  @Throttle({ short: { ttl: 60000, limit: 10 } })
  create(@Body() dto: CreateReceiptDto, @Req() req: RequestWithUser) {
    return this.receiptsService.create(dto, req.user.userId);
  }

  @Get()
  findAll(@Query() query: QueryReceiptsDto, @Req() req: RequestWithUser) {
    return this.receiptsService.findAllForUser(req.user.userId, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.receiptsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateReceiptDto,
    @Req() req: RequestWithUser,
  ) {
    return this.receiptsService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.receiptsService.remove(id, req.user.userId);
  }

  @Delete()
  removeAll(@Req() req: RequestWithUser) {
    return this.receiptsService.removeAllForUser(req.user.userId);
  }

  @Post(':id/reprocess')
  @Throttle({ short: { ttl: 60000, limit: 5 } })
  reprocess(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.receiptsService.reprocess(id, req.user.userId);
  }
}
