import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ObservationsController } from './observations.controller';
import { ObservationsService } from './observations.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ObservationsController],
  providers: [ObservationsService, PrismaService],
})
export class ObservationsModule {}
