import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MilestonesController } from './milestones.controller';
import { MilestonesService } from './milestones.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MilestonesController],
  providers: [MilestonesService, PrismaService],
})
export class MilestonesModule {}
