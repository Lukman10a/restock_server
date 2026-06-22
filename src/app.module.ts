import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './users/user.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { AuthModule } from './auth/auth.module';
import { UploadController } from './upload/upload.controller';
import { CloudinaryService } from './upload/cloudinaryupload.service';
import { UploadModule } from './upload/upload.module';
import { OcrService } from './ocr/ocr.service';
import { OcrModule } from './ocr/ocr.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
    }),
    UserModule,
    ReceiptsModule,
    AuthModule,
    JwtModule.register({}),
    UploadModule,
    OcrModule,
  ],
  controllers: [AppController, AuthController, UploadController],
  providers: [AppService, AuthService, CloudinaryService, OcrService],
})
export class AppModule {}
