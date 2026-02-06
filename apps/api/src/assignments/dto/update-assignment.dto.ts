import { IsIn, IsNumber, IsOptional, Min, IsString, Matches } from 'class-validator';

export class UpdateAssignmentDto {
  @IsIn(['PENDING', 'CONFIRMED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cashTips?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tipsEarned?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  sittingTips?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  takeawayTips?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deliveryTips?: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'actualStartTime must be in HH:MM format' })
  @IsOptional()
  actualStartTime?: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'actualEndTime must be in HH:MM format' })
  @IsOptional()
  actualEndTime?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  actualHours?: number;
}
