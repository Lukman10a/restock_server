// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  password!: string; // hashed, never store plain text

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  refreshToken!: string; // hashed refresh token, used for /auth/refresh
}

export const UserSchema = SchemaFactory.createForClass(User);
