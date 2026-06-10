import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Locale, NotificationChannel } from '@sherpa/shared';
import { Notification, NotificationTemplate, User } from '../database/entities';
import { NotificationProvider } from './provider';
import {
  ConsoleProvider,
  FcmProvider,
  WhatsappProvider,
} from './adapters';
import { env } from '../config/env';
import { interpolate } from '../common/template';

export interface SendOptions {
  templateKey: string;
  channel: NotificationChannel;
  locale?: Locale;
  vars?: Record<string, string | number>;
  recipientUserId?: string;
  recipientContact?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('NotificationsService');
  private readonly providers: NotificationProvider[];
  private readonly console = new ConsoleProvider();

  constructor(
    @InjectRepository(NotificationTemplate)
    private readonly templates: Repository<NotificationTemplate>,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {
    // wire adapters from env; console is always the fallback
    this.providers = [];
    if (env.notify.pushProvider === 'fcm') this.providers.push(new FcmProvider());
    if (env.notify.whatsappProvider === 'whatsapp') this.providers.push(new WhatsappProvider());
    this.providers.push(this.console);
  }

  /** {{var}} interpolation over a template body. */
  interpolate(body: string, vars: Record<string, string | number> = {}): string {
    return interpolate(body, vars);
  }

  private pick(channel: NotificationChannel): NotificationProvider {
    return this.providers.find((p) => p.supports(channel)) ?? this.console;
  }

  async send(opts: SendOptions): Promise<Notification> {
    const locale = opts.locale ?? 'es';
    let template = await this.templates.findOne({
      where: { key: opts.templateKey, channel: opts.channel, locale, active: true },
    });
    // fall back to the other locale, then to a bare body
    if (!template) {
      template = await this.templates.findOne({
        where: { key: opts.templateKey, channel: opts.channel },
      });
    }
    const rawBody = template?.body ?? opts.templateKey;
    const body = interpolate(rawBody, opts.vars);
    const subject = template?.subject
      ? interpolate(template.subject, opts.vars)
      : undefined;

    let to = opts.recipientContact ?? '';
    if (!to && opts.recipientUserId) {
      const user = await this.users.findOne({ where: { id: opts.recipientUserId } });
      to = user?.phone ?? user?.email ?? opts.recipientUserId;
    }

    const provider = this.pick(opts.channel);
    let status = 'sent';
    try {
      await provider.send({ channel: opts.channel, to, subject, body });
    } catch (e: any) {
      status = 'failed';
      this.logger.error(`send failed via ${provider.name}: ${e.message}`);
    }

    return this.notifications.save(
      this.notifications.create({
        recipientUserId: opts.recipientUserId,
        recipientContact: opts.recipientContact,
        channel: opts.channel,
        templateKey: opts.templateKey,
        subject,
        renderedBody: body,
        status,
      }),
    );
  }
}
