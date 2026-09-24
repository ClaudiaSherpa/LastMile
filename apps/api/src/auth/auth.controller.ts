import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto, RegisterDto } from './dto';
import { CurrentUser, Public } from './decorators';
import { JwtPayload } from '@sherpa/shared';
import { env } from '../config/env';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly jwt: JwtService,
  ) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  // ── password reset (delivered via WhatsApp) ──
  @Public()
  @Post('forgot')
  forgot(@Body() body: { username: string }) {
    return this.auth.requestReset(body?.username);
  }

  @Public()
  @Get('reset/:token')
  getReset(@Param('token') token: string) {
    return this.auth.getReset(token);
  }

  @Public()
  @Post('reset/:token')
  resetPassword(@Param('token') token: string, @Body() body: { password: string }) {
    return this.auth.resetPassword(token, body?.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync(dto.refreshToken, {
        secret: env.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.auth.refresh(payload.sub, dto.refreshToken);
  }

  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload) {
    await this.auth.logout(user.sub);
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
