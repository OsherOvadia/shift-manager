import { Module } from '@nestjs/common';
import { HoursImportService } from './hours-import.service';
import { HoursImportController } from './hours-import.controller';

@Module({
  controllers: [HoursImportController],
  providers: [HoursImportService],
  exports: [HoursImportService],
})
export class HoursImportModule {}
