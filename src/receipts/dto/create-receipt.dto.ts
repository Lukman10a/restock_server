// src/receipts/dto/create-receipt.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReceiptDto {
  @IsNotEmpty()
  @IsString()
  imageUrl!: string;

  @IsNotEmpty()
  @IsString()
  imagePublicId!: string;
}
