import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDailyRevenueDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalRevenue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
