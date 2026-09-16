import { Body, Controller, Get, Post, Query, UnauthorizedException } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { Role } from '@sherpa/shared';
import { Public, Roles } from '../auth/decorators';
import { WhatsAppService } from './whatsapp.service';
import { env } from '../config/env';

class SendWhatsAppDto {
  @IsString() to: string;
  @IsString() text: string;
  @IsOptional() @IsString() driverId?: string;
}

class RegisterWebhookDto {
  @IsOptional() @IsString() apiBaseUrl?: string;
}

@Controller()
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  /** Ops sends a WhatsApp message to a contact/driver. */
  @Post('whatsapp/send')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  send(@Body() dto: SendWhatsAppDto) {
    return this.whatsapp.send(dto.to, dto.text, dto.driverId);
  }

  /** Recent inbound + outbound message log for the Ops console. */
  @Get('whatsapp/messages')
  @Roles(Role.ADMIN, Role.DISPATCHER)
  list() {
    return this.whatsapp.list();
  }

  /** Point the Evolution instance at this API's inbound webhook (admin helper). */
  @Post('whatsapp/webhook/register')
  @Roles(Role.ADMIN)
  register(@Body() dto: RegisterWebhookDto) {
    return this.whatsapp.registerWebhook(dto.apiBaseUrl ?? 'http://localhost:3100');
  }

  /**
   * Inbound webhook Evolution POSTs to on new messages. Public but gated by a
   * shared ?token= secret (Evolution can't send our JWT).
   */
  @Public()
  @Post('integrations/whatsapp/webhook')
  webhook(@Query('token') token: string, @Body() body: any) {
    if (token !== env.notify.evolution.webhookToken) throw new UnauthorizedException('Bad webhook token');
    return this.whatsapp.handleWebhook(body);
  }
}
