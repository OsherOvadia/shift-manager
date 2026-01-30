import { IsString, IsIn, IsInt, Min, Max, Matches } from 'class-validator';

export class CreateShiftTemplateDto {
  @IsString()
  name: string;

  @IsIn(['MORNING', 'EVENING', 'EVENING_CLOSE'])
  shiftType: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'שעת התחלה לא תקינה (HH:MM)' })
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'שעת סיום לא תקינה (HH:MM)' })
  endTime: string;

  @IsInt()
  @Min(1)
  minStaff: number;

  @IsInt()
  @Min(1)
  @Max(50)
  maxStaff: number;
}
