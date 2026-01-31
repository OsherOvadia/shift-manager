import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDailyRevenueDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @Min(0)
  totalRevenue: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sittingRevenue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  takeawayRevenue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryRevenue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
