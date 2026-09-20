import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { Role } from '@sherpa/shared';
import { User } from '../database/entities';
import { env } from '../config/env';

const STAFF_ROLES = [Role.ADMIN, Role.DISPATCHER, Role.SECURITY_OFFICER];

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  private opsUrl() {
    return `${env.api.publicBaseUrl.replace(/\/$/, '')}/ops`;
  }
  private inviteUrl(token: string) {
    return `${this.opsUrl()}?invite=${token}`;
  }

  /** Admin creates a staff user by phone + role; returns an invite link. */
  async invite(phone: string, role: Role) {
    const clean = (phone ?? '').trim();
    if (!clean) throw new BadRequestException('Phone number required');
    if (!STAFF_ROLES.includes(role)) throw new BadRequestException('Role must be admin, dispatcher or security_officer');
    const existing = await this.users.findOne({ where: { phone: clean } });
    if (existing) throw new BadRequestException('A user with this phone number already exists');

    const inviteToken = crypto.randomBytes(24).toString('hex');
    const user = await this.users.save(
      this.users.create({ phone: clean, role, fullName: '(pending)', active: false, inviteToken }),
    );
    return { id: user.id, phone: clean, role, inviteToken, inviteUrl: this.inviteUrl(inviteToken), opsUrl: this.opsUrl() };
  }

  /** Public: look up a pending invite for the accept form. */
  async getInvite(token: string) {
    const user = await this.users.findOne({ where: { inviteToken: token, active: false } });
    if (!user) throw new NotFoundException('Invite not found or already used');
    return { phone: user.phone, role: user.role };
  }

  /** Public: the invitee completes their profile + sets a password. */
  async acceptInvite(token: string, input: { firstName?: string; lastName?: string; email?: string; password?: string }) {
    const user = await this.users.findOne({ where: { inviteToken: token, active: false } });
    if (!user) throw new NotFoundException('Invite not found or already used');
    const fullName = [input.firstName, input.lastName].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
    if (!fullName) throw new BadRequestException('Name is required');
    if (!input.password || input.password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    user.fullName = fullName;
    if (input.email) user.email = input.email.trim();
    user.passwordHash = await argon2.hash(input.password);
    user.active = true;
    user.inviteToken = undefined;
    try {
      await this.users.save(user);
    } catch (e: any) {
      if (e?.code === '23505') throw new BadRequestException('That email is already in use');
      throw e;
    }
    return { ok: true, opsUrl: this.opsUrl() };
  }

  /** Admin: list staff users (non-drivers) with status + pending invite links. */
  async list() {
    const rows = await this.users.find({ where: { role: Not(Role.DRIVER) }, order: { createdAt: 'DESC' } });
    return rows.map((u) => ({
      id: u.id,
      name: u.fullName,
      phone: u.phone,
      email: u.email ?? null,
      role: u.role,
      status: u.active ? 'active' : 'pending',
      inviteUrl: u.inviteToken ? this.inviteUrl(u.inviteToken) : null,
      createdAt: u.createdAt,
    }));
  }

  /** Admin: revoke a pending (not-yet-accepted) invite. */
  async revoke(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.active) throw new BadRequestException('User is already active; cannot revoke');
    await this.users.remove(user);
    return { ok: true };
  }
}
