import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApprovalOutcome, SecurityCheckResult } from '@sherpa/shared';

export class DecisionDto {
  @IsEnum(ApprovalOutcome)
  outcome: ApprovalOutcome;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class SecurityCheckDto {
  @IsString()
  check: string; // identity | criminal | sanctions | vehicle

  @IsEnum(SecurityCheckResult)
  result: SecurityCheckResult;
}
