import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Role } from '@sherpa/shared';
import { Public, Roles } from '../auth/decorators';
import { RatingsService } from './ratings.service';

class SubmitRatingDto {
  @IsString() token: string;
  @IsInt() @Min(1) @Max(5) stars: number;
  @IsOptional() @IsString() feedback?: string;
}

@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  /** Consignee submits a rating via the link token — no account. */
  @Public()
  @Post()
  submit(@Body() dto: SubmitRatingDto) {
    return this.ratings.submit(dto.token, dto.stars, dto.feedback);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCHER)
  list(@Query('driverId') driverId?: string) {
    return this.ratings.list(driverId);
  }
}
