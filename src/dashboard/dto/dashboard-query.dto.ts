// src/dashboard/dto/dashboard-query.dto.ts
import { IsOptional, IsNumberString, IsIn } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsNumberString()
  year?: string;

  @IsOptional()
  @IsNumberString()
  month?: string; // 1-12, if provided gives stats for that specific month

  @IsOptional()
  @IsIn(['USD', 'EUR', 'GBP', 'NGN', 'SAR', 'KWD'])
  currency?: string;
}
