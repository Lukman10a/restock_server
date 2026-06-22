// src/export/dto/export-receipts.dto.ts
import { IsOptional, IsIn, IsDateString } from 'class-validator';

export class ExportReceiptsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['pending', 'processed', 'failed', 'manually_edited'])
  status?: string;
}
