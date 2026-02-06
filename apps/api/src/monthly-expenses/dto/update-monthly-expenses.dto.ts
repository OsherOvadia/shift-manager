import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMonthlyExpensesDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  foodCosts?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  extras?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
