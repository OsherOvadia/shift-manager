import { IsIn, IsOptional } from 'class-validator';

export class UpdateAssignmentDto {
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED'])
  @IsOptional()
  status?: string;
}
