import { IsString, IsNumber, IsOptional, Min, IsDateString } from 'class-validator';

export class CreateCookHoursDto {
  @IsString()
  userId: string;

  @IsDateString()
  weekStart: string;

  @IsNumber()
  @Min(0)
  totalHours: number;

  @IsNumber()
  @Min(0)
  hourlyWage: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
