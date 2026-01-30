import { IsString, IsIn, IsInt, IsBoolean, IsOptional, Min, Max, Matches } from 'class-validator';

export class UpdateShiftTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsIn(['MORNING', 'EVENING', 'EVENING_CLOSE'])
  @IsOptional()
  shiftType?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'שעת התחלה לא תקינה (HH:MM)' })
  @IsOptional()
  startTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'שעת סיום לא תקינה (HH:MM)' })
  @IsOptional()
  endTime?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  minStaff?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  maxStaff?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
