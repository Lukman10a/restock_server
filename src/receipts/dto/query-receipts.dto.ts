// src/receipts/dto/query-receipts.dto.ts
import { IsOptional, IsNumberString, IsIn } from 'class-validator';

export class QueryReceiptsDto {
  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsIn(['pending', 'processed', 'failed', 'manually_edited'])
  status?: string;
}
