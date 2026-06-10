import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@sherpa/shared';

export class LoginDto {
  @IsString()
  username: string; // email or phone

  @IsString()
  @MinLength(6)
  password: string;
}

export class RegisterDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  fullName: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}
