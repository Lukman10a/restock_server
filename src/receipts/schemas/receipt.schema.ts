import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReceiptDocument = Receipt & Document;

@Schema({ _id: false })
export class ReceiptItem {
  @Prop({ required: true })
  name!: string;

  @Prop({ default: 0 })
  quantity!: number;

  @Prop({ default: 0 })
  unitPrice!: number;

  @Prop({ default: 0 })
  totalPrice!: number;
}

@Schema({ timestamps: true })
export class Receipt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, default: null })
  userId!: Types.ObjectId;

  @Prop({ required: true, default: '' })
  imageUrl!: string;

  @Prop()
  rawOcrText?: string;

  @Prop()
  vendorName?: string;

  @Prop()
  vendorAddress?: string;

  @Prop({ default: 0 })
  totalAmount!: number;

  @Prop({ default: 'USD' })
  currency!: string;

  @Prop()
  purchaseDate?: Date;

  @Prop({ type: [ReceiptItem], default: [] })
  items!: ReceiptItem[];

  @Prop({
    enum: ['pending', 'processed', 'failed', 'manually_edited'],
    default: 'pending',
  })
  status!: string;

  @Prop()
  ocrConfidence?: number;
}

export const ReceiptSchema = SchemaFactory.createForClass(Receipt);
