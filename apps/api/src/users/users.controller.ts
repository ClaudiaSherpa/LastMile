import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@sherpa/shared';
import { Public, Roles } from '../auth/decorators';
import { UsersService } from './users.service';
import { AuthService } from '../auth/auth.service';

class InviteDto {
  @IsString() phone: string;
  @IsEnum(Role) role: Role;
}
class AcceptDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(6) password: string;
}

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService, private readonly auth: AuthService) {}

  @Post('users/:id/reset-password')
  @Roles(Role.ADMIN)
  resetPassword(@Param('id') id: string) {
    return this.auth.requestResetForUser(id);
  }

  @Post('users/invite')
  @Roles(Role.ADMIN)
  invite(@Body() dto: InviteDto) {
    return this.users.invite(dto.phone, dto.role);
  }

  @Get('users')
  @Roles(Role.ADMIN)
  list() {
    return this.users.list();
  }

  @Delete('users/:id')
  @Roles(Role.ADMIN)
  revoke(@Param('id') id: string) {
    return this.users.revoke(id);
  }

  // ── public invite-acceptance flow ──
  @Public()
  @Get('users/invite/:token')
  getInvite(@Param('token') token: string) {
    return this.users.getInvite(token);
  }

  @Public()
  @Post('users/invite/:token/accept')
  accept(@Param('token') token: string, @Body() dto: AcceptDto) {
    return this.users.acceptInvite(token, dto);
  }
}
