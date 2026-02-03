import { Module } from '@nestjs/common';
import { CookPayrollService } from './cook-payroll.service';
import { CookPayrollController } from './cook-payroll.controller';

@Module({
  controllers: [CookPayrollController],
  providers: [CookPayrollService],
  exports: [CookPayrollService],
})
export class CookPayrollModule {}
