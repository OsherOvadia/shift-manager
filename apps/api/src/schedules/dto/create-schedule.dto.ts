import { IsDateString } from 'class-validator';

export class CreateScheduleDto {
  @IsDateString()
  weekStartDate: string;
}
