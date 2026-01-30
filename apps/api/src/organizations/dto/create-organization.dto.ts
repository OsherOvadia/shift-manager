import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail({}, { message: 'כתובת אימייל לא תקינה' })
  adminEmail: string;

  @IsString()
  @MinLength(8, { message: 'סיסמה חייבת להכיל לפחות 8 תווים' })
  adminPassword: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  adminFirstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  adminLastName: string;
}
