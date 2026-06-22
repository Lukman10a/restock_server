// src/users/users.service.ts

import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const user = new this.userModel(dto);
    return user.save();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { refreshToken }).exec();
  }

  async getProfile(userId: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshToken')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { ...dto }, { new: true })
      .select('-password -refreshToken')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashed = await bcrypt.hash(dto.newPassword, 10);

    await this.userModel.findByIdAndUpdate(userId, { password: hashed }).exec();

    return { message: 'Password changed successfully' };
  }

  async deleteAccount(userId: string): Promise<{ message: string }> {
    const deleted = await this.userModel.findByIdAndDelete(userId).exec();

    if (!deleted) {
      throw new NotFoundException('User not found');
    }

    return { message: 'Account deleted successfully' };
  }
}
