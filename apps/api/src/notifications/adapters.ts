import { Logger } from '@nestjs/common';
import { NotificationChannel } from '@sherpa/shared';
import { NotificationProvider, OutboundMessage } from './provider';
import { env } from '../config/env';

/** Default dev adapter — logs to stdout so the platform runs with no external service. */
export class ConsoleProvider implements NotificationProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Notify');
  supports(): boolean {
    return true;
  }
  async send(message: OutboundMessage): Promise<void> {
    this.logger.log(
      `[${message.channel}] → ${message.to}: ${message.subject ? message.subject + ' — ' : ''}${message.body}`,
    );
  }
}

/** FCM push adapter (env-gated). Falls back to a no-op log when unconfigured. */
export class FcmProvider implements NotificationProvider {
  readonly name = 'fcm';
  private readonly logger = new Logger('FCM');
  supports(channel: NotificationChannel): boolean {
    return channel === NotificationChannel.PUSH;
  }
  async send(message: OutboundMessage): Promise<void> {
    if (!env.notify.fcmServerKey) {
      this.logger.warn(`FCM not configured; would push to ${message.to}: ${message.body}`);
      return;
    }
    await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        Authorization: `key=${env.notify.fcmServerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: message.to,
        notification: { title: message.subject ?? 'PasarEx LM', body: message.body },
      }),
    }).catch((e) => this.logger.error(`FCM send failed: ${e.message}`));
  }
}

/** WhatsApp via Evolution API (env-gated). */
export class WhatsappProvider implements NotificationProvider {
  readonly name = 'whatsapp';
  private readonly logger = new Logger('WhatsApp');
  supports(channel: NotificationChannel): boolean {
    return channel === NotificationChannel.WHATSAPP || channel === NotificationChannel.SMS;
  }
  async send(message: OutboundMessage): Promise<void> {
    const { url, key, instance } = env.notify.evolution;
    if (!key) {
      this.logger.warn(`Evolution API key missing; would WhatsApp ${message.to}: ${message.body}`);
      return;
    }
    await fetch(`${url}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: message.to, text: message.body }),
    }).catch((e) => this.logger.error(`Evolution send failed: ${e.message}`));
  }
}
