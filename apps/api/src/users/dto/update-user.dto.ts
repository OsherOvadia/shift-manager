import { IsString, IsIn, IsBoolean, IsOptional, MinLength, MaxLength, IsUUID, IsNumber, Min } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  firstName?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @IsOptional()
  lastName?: string;

  @IsIn(['ADMIN', 'MANAGER', 'EMPLOYEE'])
  @IsOptional()
  role?: string;

  @IsIn(['FULL_TIME', 'PART_TIME'])
  @IsOptional()
  employmentType?: string;

  @IsUUID('4')
  @IsOptional()
  jobCategoryId?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  hourlyWage?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  baseHourlyWage?: number;

  @IsBoolean()
  @IsOptional()
  isTipBased?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
