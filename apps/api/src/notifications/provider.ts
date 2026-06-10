import { NotificationChannel } from '@sherpa/shared';

export interface OutboundMessage {
  channel: NotificationChannel;
  to: string; // userId-resolved contact, phone, or device token
  subject?: string;
  body: string;
}

/** Single interface all notification adapters implement (console, FCM, WhatsApp). */
export interface NotificationProvider {
  readonly name: string;
  supports(channel: NotificationChannel): boolean;
  send(message: OutboundMessage): Promise<void>;
}
