import { IsNumber, IsOptional, Min, IsString } from 'class-validator';

export class UpdateCookHoursDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalHours?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hourlyWage?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
