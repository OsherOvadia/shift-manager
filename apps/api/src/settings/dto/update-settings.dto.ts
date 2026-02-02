import { IsArray, IsInt, IsOptional, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class UpdateSettingsDto {
  @IsArray()
  @IsInt({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsOptional()
  weekendDays?: number[];

  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  submissionDeadlineDay?: number;

  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  submissionDeadlineHour?: number;

  @IsArray()
  @IsOptional()
  closedPeriods?: Array<{
    day: number; // 0=Sunday, 6=Saturday
    shiftTypes: string[]; // ['MORNING', 'EVENING', 'EVENING_CLOSE']
  }>;
}
