import { Module } from '@nestjs/common';
import { MonthlyExpensesController } from './monthly-expenses.controller';
import { MonthlyExpensesService } from './monthly-expenses.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MonthlyExpensesController],
  providers: [MonthlyExpensesService],
  exports: [MonthlyExpensesService],
})
export class MonthlyExpensesModule {}
