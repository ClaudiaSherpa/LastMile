import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsArray, IsObject, IsOptional } from 'class-validator';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { ScoringService } from './scoring.service';

class UpdateScoringDto {
  @IsOptional() @IsObject() weights?: any;
  @IsOptional() @IsArray() tiers?: any[];
}

@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  @Get('config')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  config() {
    return this.scoring.activeConfig();
  }

  @Post('config')
  @Roles(Role.ADMIN)
  update(@Body() dto: UpdateScoringDto) {
    return this.scoring.updateConfig(dto.weights, dto.tiers);
  }

  @Post('recompute')
  @Roles(Role.ADMIN)
  recompute() {
    return this.scoring.recomputeAll();
  }
}
