import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WhatsAppMessage } from '../database/entities';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { env } from '../config/env';

const WA_EVENT = 'whatsapp.message';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger('WhatsApp');

  constructor(
    @InjectRepository(WhatsAppMessage) private readonly messages: Repository<WhatsAppMessage>,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Evolution wants a plain international number (digits only, no +/spaces). */
  private normalize(num: string): string {
    return (num || '').replace(/\D/g, '');
  }

  private dto(m: WhatsAppMessage) {
    return {
      id: m.id,
      direction: m.direction,
      contact: m.contact,
      body: m.body,
      status: m.status,
      at: m.createdAt,
    };
  }

  /** Send a WhatsApp text via Evolution, persisting the outbound record either way. */
  async send(to: string, text: string, driverId?: string) {
    const contact = this.normalize(to);
    if (!contact) throw new BadRequestException('Recipient number required');
    if (!text?.trim()) throw new BadRequestException('Message text required');

    const { url, key, instance } = env.notify.evolution;
    let status = 'sent';
    let providerMessageId: string | undefined;

    if (!key) {
      status = 'skipped';
      this.logger.warn(`Evolution API key missing; not sending to ${contact}`);
    } else {
      try {
        const res = await fetch(`${url}/message/sendText/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: { apikey: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: contact, text }),
        });
        if (!res.ok) {
          status = 'failed';
          this.logger.error(`Evolution send → ${res.status} ${await res.text().catch(() => '')}`);
        } else {
          const body: any = await res.json().catch(() => ({}));
          providerMessageId = body?.key?.id ?? body?.message?.key?.id;
        }
      } catch (e: any) {
        status = 'failed';
        this.logger.error(`Evolution send failed: ${e.message}`);
      }
    }

    const saved = await this.messages.save(
      this.messages.create({ direction: 'out', contact, body: text, status, providerMessageId, driverId }),
    );
    this.realtime.emitOps(WA_EVENT, this.dto(saved));
    return this.dto(saved);
  }

  /** Ingest an Evolution webhook event (messages.upsert), persisting inbound texts. */
  async handleWebhook(payload: any) {
    const data = payload?.data;
    if (!data) return { received: 0, ignored: payload?.event ?? 'no-data' };

    const items = Array.isArray(data) ? data : [data];
    let received = 0;
    for (const it of items) {
      if (!it?.key || it.key.fromMe) continue; // skip echoes of our own sends
      const contact = this.normalize(String(it.key.remoteJid ?? '').split('@')[0]);
      if (!contact) continue;
      const msg = it.message ?? {};
      const body =
        msg.conversation ??
        msg.extendedTextMessage?.text ??
        msg.imageMessage?.caption ??
        msg.videoMessage?.caption ??
        '';

      const saved = await this.messages.save(
        this.messages.create({
          direction: 'in',
          contact,
          body,
          status: 'received',
          providerMessageId: it.key.id,
          raw: it,
        }),
      );
      this.realtime.emitOps(WA_EVENT, this.dto(saved));
      this.logger.log(`inbound WhatsApp from ${contact}: ${body?.slice(0, 60)}`);
      received++;
    }
    return { received };
  }

  async list(limit = 100) {
    const rows = await this.messages.find({ order: { createdAt: 'DESC' }, take: limit });
    return rows.map((m) => this.dto(m));
  }

  /** Register this API's webhook URL with the Evolution instance (best-effort helper). */
  async registerWebhook(apiBaseUrl: string) {
    const { url, key, instance, webhookToken } = env.notify.evolution;
    if (!key) throw new BadRequestException('Evolution API key not configured');
    const webhookUrl = `${apiBaseUrl.replace(/\/$/, '')}/api/integrations/whatsapp/webhook?token=${webhookToken}`;
    const res = await fetch(`${url}/webhook/set/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhook: { enabled: true, url: webhookUrl, events: ['MESSAGES_UPSERT'] } }),
    }).catch((e) => {
      throw new BadRequestException(`Evolution webhook set failed: ${e.message}`);
    });
    return { ok: res.ok, status: res.status, webhookUrl };
  }
}
