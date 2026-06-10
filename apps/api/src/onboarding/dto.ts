import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateDraftDto {
  @IsObject()
  patch: Record<string, any>;
}

export class TokenQueryDto {
  @IsString()
  token: string;
}

export class SubmitDto {
  @IsString()
  token: string;

  @IsOptional()
  @IsString()
  password?: string;
}
