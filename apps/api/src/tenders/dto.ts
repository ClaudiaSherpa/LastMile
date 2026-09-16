import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { VehicleType } from '@sherpa/shared';

export class CreateFreightDto {
  @IsString() client: string;
  @IsOptional() @IsString() consigneeName?: string;
  @IsOptional() @IsString() consigneePhone?: string;
  @IsString() pickupZone: string;
  @IsString() dropZone: string;
  @IsEnum(VehicleType) requiredVehicle: VehicleType;
  @IsNumber() @Min(0) weightKg: number;
  @IsOptional() @IsInt() windowMinutes?: number;
  @IsOptional() @IsNumber() distanceKm?: number;
  @IsInt() @Min(0) payout: number;
  @IsOptional() @IsBoolean() priority?: boolean;
}
