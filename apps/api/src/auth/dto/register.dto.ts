import { IsEmail, IsString, IsIn, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'סיסמה חייבת להכיל לפחות 8 תווים' })
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(2, { message: 'שם פרטי חייב להכיל לפחות 2 תווים' })
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2, { message: 'שם משפחה חייב להכיל לפחות 2 תווים' })
  @MaxLength(50)
  lastName: string;

  @IsIn(['ADMIN', 'MANAGER', 'EMPLOYEE'], { message: 'תפקיד לא תקין' })
  role: string;

  @IsIn(['FULL_TIME', 'PART_TIME'], { message: 'סוג העסקה לא תקין' })
  employmentType: string;
}
