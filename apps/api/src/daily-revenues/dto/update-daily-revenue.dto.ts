import { PartialType } from '@nestjs/mapped-types';
import { CreateDailyRevenueDto } from './create-daily-revenue.dto';

export class UpdateDailyRevenueDto extends PartialType(CreateDailyRevenueDto) {}
