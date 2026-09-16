import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { AuthTokens, JwtPayload, Role } from '@sherpa/shared';
import { User } from '../database/entities';
import { env } from '../config/env';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

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
