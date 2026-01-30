import { IsUUID, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class AssignmentItemDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  shiftTemplateId: string;

  @IsDateString()
  shiftDate: string;
}

export class BulkAssignmentDto {
  @IsUUID()
  scheduleId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentItemDto)
  assignments: AssignmentItemDto[];
}
