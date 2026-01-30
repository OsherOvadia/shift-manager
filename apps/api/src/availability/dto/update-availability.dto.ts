import { IsArray, ValidateNested, IsIn, IsInt, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class AvailabilitySlotDto {
  @IsDateString()
  shiftDate: string;

  @IsIn(['MORNING', 'EVENING', 'EVENING_CLOSE'])
  shiftType: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  preferenceRank?: number;
}

export class UpdateAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  @IsOptional()
  slots?: AvailabilitySlotDto[];
}
