import { IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';

export class CreateJobCategoryDto {
  @IsString()
  @MinLength(2, { message: 'שם חייב להכיל לפחות 2 תווים' })
  @MaxLength(50)
  name: string;

  @IsString()
  @MinLength(2, { message: 'שם בעברית חייב להכיל לפחות 2 תווים' })
  @MaxLength(50)
  nameHe: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'צבע חייב להיות בפורמט HEX' })
  color?: string;
}
