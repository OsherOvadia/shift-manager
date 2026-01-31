import { Module } from '@nestjs/common';
import { DailyRevenuesService } from './daily-revenues.service';
import { DailyRevenuesController } from './daily-revenues.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DailyRevenuesController],
  providers: [DailyRevenuesService],
  exports: [DailyRevenuesService],
})
export class DailyRevenuesModule {}
