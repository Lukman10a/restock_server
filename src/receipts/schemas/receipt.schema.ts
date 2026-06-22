// src/receipts/schemas/receipt.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReceiptDocument = Receipt & Document;

@Schema({ _id: false })
export class ReceiptItem {
  @Prop({ required: true })
  name!: string;

  @Prop()
  quantity!: number;

  @Prop()
  unitPrice!: number;

  @Prop()
  totalPrice!: number;
}

export const ReceiptItemSchema = SchemaFactory.createForClass(ReceiptItem);

@Schema({ timestamps: true })
export class Receipt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId!: Types.ObjectId;

  @Prop({ required: true })
  imageUrl!: string; // Cloudinary secure_url

  @Prop({ required: true })
  imagePublicId!: string; // Cloudinary public_id, needed for deletion

  @Prop()
  rawOcrText!: string; // unprocessed text straight from OCR provider

  @Prop()
  vendorName!: string;

  @Prop()
  vendorAddress!: string;

  @Prop()
  totalAmount!: number;

  @Prop()
  currency!: string;

  @Prop()
  purchaseDate!: Date;

  @Prop({ type: [ReceiptItemSchema], default: [] })
  items!: ReceiptItem[];

  @Prop({
    enum: ['pending', 'processed', 'failed', 'manually_edited'],
    default: 'pending',
  })
  status!: string;

  @Prop()
  ocrConfidence!: number;

  createdAt!: Date;

  updatedAt!: Date;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);
