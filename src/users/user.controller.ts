// src/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// ✅ Define a proper type for req.user
interface JwtUser {
  userId: string;
  email?: string;
}

interface JwtRequest extends Request {
  user: JwtUser;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@Req() req: JwtRequest) {
    return this.usersService.getProfile(req.user.userId);
  }

  @Patch('me')
  updateProfile(@Body() dto: UpdateProfileDto, @Req() req: JwtRequest) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  @Patch('me/change-password')
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: JwtRequest) {
    return this.usersService.changePassword(req.user.userId, dto);
  }

  @Delete('me')
  deleteAccount(@Req() req: JwtRequest) {
    return this.usersService.deleteAccount(req.user.userId);
  }
}
