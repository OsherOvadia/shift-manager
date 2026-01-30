import { IsEmail, IsString, IsBoolean, IsOptional, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'סיסמה חייבת להכיל לפחות 8 תווים' })
  password: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
