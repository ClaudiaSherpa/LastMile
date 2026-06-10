import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env';
import { normalizeOcrFields, parseOcrJson } from './normalize';

export interface OcrResult {
  /** false when OCR ran (or was skipped) without throwing */
  ok: boolean;
  /** true when skipped because no key / unsupported file */
  skipped: boolean;
  reason?: string;
  /** normalized fields mapped to onboarding draft keys */
  fields: Record<string, string>;
  /** raw model text, for debugging */
  raw?: string;
}

// What to pull out of each document type, expressed for the vision model.
const EXTRACTION_HINTS: Record<string, string> = {
  license:
    'Colombian driver license (licencia de conducción). Extract: name (full name), cedula (id number, digits only), licenseNumber, categories (e.g. A2,B1), issueDate, expiryDate.',
  soat:
    'Colombian SOAT mandatory insurance. Extract: plate (vehicle plate), policyNumber, insurer, issueDate, expiryDate (vigencia hasta).',
  insurance:
    'Vehicle all-risk insurance policy (póliza todo riesgo). Extract: plate, policyNumber, insurer, issueDate, expiryDate.',
  property:
    'Colombian vehicle registration card (tarjeta de propiedad). Extract: plate, brand (marca), model (línea), year (modelo año, 4 digits), color, name (owner full name), cedula (owner id).',
  id: 'Colombian national ID (cédula de ciudadanía) with selfie. Extract: name (full name), cedula (id number, digits only).',
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger('OCR');

  get enabled(): boolean {
    return !!env.ocr.apiKey;
  }

  /**
   * Run OCR auto-fill against an uploaded document. Returns normalized draft
   * fields. Never throws — degrades to { skipped } so manual entry still works.
   */
  async extract(buffer: Buffer, mimeType: string, docTypeKey: string): Promise<OcrResult> {
    if (!this.enabled) {
      return { ok: true, skipped: true, reason: 'no_api_key', fields: {} };
    }
    if (!mimeType.startsWith('image/')) {
      return { ok: true, skipped: true, reason: 'unsupported_mime', fields: {} };
    }

    const hint = EXTRACTION_HINTS[docTypeKey] ?? 'Extract any identity or vehicle fields you can read.';
    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    const prompt =
      `You are an OCR field extractor for a logistics onboarding form in Colombia.\n` +
      `Document: ${hint}\n` +
      `Return ONLY a compact JSON object with the fields you can read. ` +
      `Use these exact keys when present: name, cedula, plate, brand, model, year, color, ` +
      `licenseNumber, policyNumber, insurer, categories, issueDate, expiryDate. ` +
      `Dates must be ISO yyyy-mm-dd. Omit keys you cannot read. No prose, no markdown.`;

    try {
      const res = await fetch(`${env.ocr.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.ocr.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://sherpa-c.com',
          'X-Title': 'Sherpa LM Onboarding OCR',
        },
        body: JSON.stringify({
          model: env.ocr.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.warn(`OpenRouter ${res.status}: ${body.slice(0, 200)}`);
        return { ok: false, skipped: false, reason: `http_${res.status}`, fields: {} };
      }

      const json: any = await res.json();
      const text: string = json?.choices?.[0]?.message?.content ?? '';
      const fields = normalizeOcrFields(parseOcrJson(text));
      this.logger.log(`extracted ${Object.keys(fields).length} fields for ${docTypeKey}`);
      return { ok: true, skipped: false, fields, raw: text };
    } catch (e: any) {
      this.logger.error(`OCR failed: ${e.message}`);
      return { ok: false, skipped: false, reason: 'exception', fields: {} };
    }
  }

}
