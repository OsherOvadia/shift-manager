import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateMonthlyExpensesDto {
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

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
