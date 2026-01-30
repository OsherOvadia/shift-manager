import { IsUUID, IsDateString } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  scheduleId: string;

  @IsUUID()
  userId: string;

  @IsUUID()
  shiftTemplateId: string;

  @IsDateString()
  shiftDate: string;
}
