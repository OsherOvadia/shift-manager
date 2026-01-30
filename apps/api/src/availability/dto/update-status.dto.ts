import { IsIn } from 'class-validator';

export class UpdateStatusDto {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'REQUIRES_CHANGES'])
  status: string;
}
