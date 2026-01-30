import { IsString, IsNumber, IsIn, IsOptional, IsUUID, Min } from 'class-validator';

export class ApproveUserDto {
  @IsUUID('4')
  @IsOptional()
  jobCategoryId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyWage?: number;

  @IsIn(['FULL_TIME', 'PART_TIME'])
  @IsOptional()
  employmentType?: string;
}
