import { IsIn } from 'class-validator';

export class UpdateScheduleDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status: string;
}
