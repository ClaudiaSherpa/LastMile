import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@sherpa/shared';
import { Roles } from '../auth/decorators';
import { RateCardService } from './rate-card.service';

/** Rate cards (driver pay). Read by admin/dispatcher; only admins may edit. */
@Controller('rate-cards')
export class RateCardController {
  constructor(private readonly cards: RateCardService) {}

  @Get()
  @Roles(Role.ADMIN, Role.DISPATCHER)
  list() {
    return this.cards.list();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() body: any) {
    return this.cards.create(body);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.cards.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.cards.remove(id);
  }
}
