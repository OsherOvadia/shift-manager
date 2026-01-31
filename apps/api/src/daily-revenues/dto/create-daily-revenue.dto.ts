import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDailyRevenueDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
