import { IsArray, IsInt, IsNumber, IsOptional, IsObject, Min, Max, ArrayMinSize, ArrayMaxSize } from 'class-validator';

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  defaultHourlyWage?: number;

  @IsObject()
  @IsOptional()
  defaultWages?: { [categoryName: string]: number }; // e.g. { waiter: 30, cook: 35, sushi: 40 }

  @IsObject()
  @IsOptional()
  shiftRequirements?: {
    FULL_TIME?: { minShifts: number; minWeekendShifts: number };
    PART_TIME?: { minShifts: number; minWeekendShifts: number };
  };

  @IsArray()
  @IsOptional()
  enabledShiftTypes?: string[]; // e.g. ['MORNING', 'EVENING'] or ['MORNING', 'EVENING', 'EVENING_CLOSE']
}
