import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { AuthTokens, JwtPayload, Role } from '@sherpa/shared';
import { User } from '../database/entities';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { env } from '../config/env';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  /**
   * Start a password reset: find the user by phone or email and, if they have a
   * phone, WhatsApp them a reset link. Always returns ok (don't leak accounts).
   */
  async requestReset(username: string): Promise<{ ok: true; sent: boolean }> {
    const id = (username ?? '').trim();
    if (!id) return { ok: true, sent: false };
    const user = await this.users.findOne({ where: [{ phone: id }, { email: id }] });
    if (!user || !user.phone) return { ok: true, sent: false };
    const token = crypto.randomBytes(24).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.users.save(user);
    const base = env.api.publicBaseUrl.replace(/\/$/, '');
    const link = `${base}${user.role === Role.DRIVER ? '' : '/ops'}?reset=${token}`;
    let sent = false;
    try {
      const res = await this.whatsapp.send(user.phone, `PasarEx: reset your password here (valid 1 hour): ${link}`, undefined);
      sent = res.status === 'sent';
    } catch { sent = false; }
    return { ok: true, sent };
  }

  /** Trigger a reset for a specific user id (admin action). Returns whether sent. */
  async requestResetForUser(userId: string): Promise<{ ok: true; sent: boolean; phone?: string }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (!user.phone) throw new BadRequestException('User has no phone number on file');
    const r = await this.requestReset(user.phone);
    return { ...r, phone: user.phone };
  }

  /** Validate a reset token (for the reset form). */
  async getReset(token: string): Promise<{ ok: true; name: string }> {
    const user = await this.users.findOne({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      throw new NotFoundException('Reset link is invalid or has expired');
    }
    return { ok: true, name: user.fullName };
  }

  /** Complete a reset: set the new password and consume the token. */
  async resetPassword(token: string, password: string): Promise<{ ok: true }> {
    if (!password || password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    const user = await this.users.findOne({ where: { resetToken: token } });
    if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      throw new NotFoundException('Reset link is invalid or has expired');
    }
    user.passwordHash = await argon2.hash(password);
    user.active = true;
    user.resetToken = null as any; // null (not undefined) so TypeORM clears the column
    user.resetTokenExpiresAt = null as any;
    await this.users.save(user);
    return { ok: true };
  }

  async validateUser(emailOrPhone: string, password: string): Promise<User> {
    const user = await this.users.findOne({
      where: [{ email: emailOrPhone }, { phone: emailOrPhone }],
      relations: { driverProfile: true },
    });
    if (!user || !user.passwordHash || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(emailOrPhone: string, password: string): Promise<AuthTokens & { user: any }> {
    const user = await this.validateUser(emailOrPhone, password);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user) };
  }

  async register(input: {
    email?: string;
    phone?: string;
    fullName: string;
    password: string;
    role?: Role;
  }): Promise<AuthTokens & { user: any }> {
    const passwordHash = await argon2.hash(input.password);
    const user = this.users.create({
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
      role: input.role ?? Role.DRIVER,
      passwordHash,
    });
    await this.users.save(user);
    const tokens = await this.issueTokens(user);
    return { ...tokens, user: this.publicUser(user) };
  }

  async refresh(userId: string, refreshToken: string): Promise<AuthTokens> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { driverProfile: true },
    });
    if (!user || !user.refreshTokenHash) throw new UnauthorizedException();
    const ok = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!ok) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.users.update(userId, { refreshTokenHash: undefined });
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      email: user.email,
      driverId: user.driverProfile?.id,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.accessSecret,
      expiresIn: env.jwt.accessTtl,
    });
    const refreshToken = await this.jwt.signAsync(payload, {
      secret: env.jwt.refreshSecret,
      expiresIn: env.jwt.refreshTtl,
    });
    user.refreshTokenHash = await argon2.hash(refreshToken);
    await this.users.save(user);
    return { accessToken, refreshToken };
  }

  publicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
