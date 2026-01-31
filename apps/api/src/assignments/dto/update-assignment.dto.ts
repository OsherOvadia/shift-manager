import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateAssignmentDto {
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tipsEarned?: number;
}
